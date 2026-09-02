const sql = require("mssql");
const { getPool } = require("./dbConnection");
const { loadCartState } = require("./durableCartStore");
const { sendCustomerJourneyEmail } = require("./sendpulse");
const {
  isMarketingStep,
  isWelcomeStep,
  normalizeJourney,
  readCustomerEmailJourney,
  slug,
  triggerKeysFor,
} = require("./customerEmailJourney");

const QUEUE_TABLE = "[dbo].[CustomerEmailQueue]";
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MAX_DELAY_MINUTES = 43_200;
const MAX_ATTEMPTS = 3;
const EVENT_TYPES = new Set([
  "account_created",
  "email_opt_in",
  "cart_inactive",
  "payment_confirmed",
  "order_packed",
  "out_for_delivery",
  "order_delivered",
]);

let schemaState = { ready: null, checkedAt: 0 };

function automationEnabled() {
  return String(process.env.MARKETING_EMAIL_AUTOMATION_ENABLED || "true").toLowerCase() !== "false";
}

function validUserId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(email) ? email : null;
}

function dateValue(value, fallback = new Date()) {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function text(value, max, fallback = "") {
  return String(value ?? fallback).trim().slice(0, max);
}

function eventMatches(step, eventType) {
  const keys = triggerKeysFor(step);
  if (keys.includes(eventType)) return true;
  // A signup starts both the welcome touchpoint and the delayed no-purchase
  // branch. This keeps the editor's trigger choices useful without requiring
  // duplicate signup events.
  if (["account_created", "email_opt_in"].includes(eventType) && keys.includes("signed_up_no_purchase")) return true;
  return false;
}

function scheduleAt(step, eventAt) {
  const delay = String(step.scheduleType || "") === "delay"
    ? Math.min(MAX_DELAY_MINUTES, Math.max(1, Math.round(Number(step.delayMinutes) || 1)))
    : 0;
  return new Date(dateValue(eventAt).getTime() + delay * 60_000);
}

function eventKeyFor({ eventType, eventKey, userId, orderId, eventAt }) {
  const supplied = text(eventKey, 180);
  if (supplied) return supplied;
  if (orderId) return `${eventType}:${text(orderId, 100)}`.slice(0, 180);
  if (eventType === "account_created") return `${eventType}:${userId}`;
  return `${eventType}:${userId}:${dateValue(eventAt).toISOString()}`.slice(0, 180);
}

function isJourneyActive(journey) {
  const status = String(journey?.status || "Active").toLowerCase();
  return status !== "paused" && status !== "draft";
}

async function automationSchemaAvailable(pool) {
  const now = Date.now();
  if (schemaState.ready !== null && now - schemaState.checkedAt < 60_000) return schemaState.ready;
  try {
    const result = await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.CustomerEmailQueue', N'U') IS NULL THEN 0 ELSE 1 END AS [Ready]");
    schemaState = { ready: Number(result.recordset?.[0]?.Ready || 0) === 1, checkedAt: now };
  } catch (error) {
    schemaState = { ready: false, checkedAt: now };
    if (Number(error?.number) !== 208) console.warn("Customer email automation schema check failed:", error?.message || error);
  }
  return schemaState.ready;
}

async function resolveMarketingConsent(pool, userId, provided) {
  if (typeof provided === "boolean") return provided;
  try {
    const result = await pool.request()
      .input("UserId", sql.Int, validUserId(userId))
      .query("SELECT TOP 1 EmailMarketing FROM dbo.CustomerAccountProfile WHERE UserID = @UserId");
    return Boolean(result.recordset?.[0]?.EmailMarketing);
  } catch (_error) {
    return false;
  }
}

async function cancelQueuedJourneySteps(pool, { userId, stepKeys = [], reason = "replaced" } = {}) {
  const normalizedUserId = validUserId(userId);
  const keys = [...new Set(stepKeys.map((key) => text(key, 100)).filter(Boolean))];
  if (!normalizedUserId || !keys.length || !(await automationSchemaAvailable(pool))) return { cancelled: 0 };

  const request = pool.request().input("UserId", sql.Int, normalizedUserId).input("Reason", sql.NVarChar(1000), text(reason, 1000));
  const parameters = keys.map((key, index) => {
    request.input(`StepKey${index}`, sql.NVarChar(100), key);
    return `@StepKey${index}`;
  });
  const result = await request.query(`
    UPDATE ${QUEUE_TABLE}
    SET [Status] = N'cancelled', [LastError] = @Reason, [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId AND [Status] IN (N'queued', N'processing') AND [StepKey] IN (${parameters.join(", ")});
    SELECT @@ROWCOUNT AS [Cancelled];
  `);
  return { cancelled: Number(result.recordset?.[0]?.Cancelled || 0) };
}

async function cancelPromotionalJourneyBranches(pool, userId, reason = "customer_order_confirmed") {
  const normalizedUserId = validUserId(userId);
  if (!normalizedUserId || !(await automationSchemaAvailable(pool))) return { cancelled: 0 };
  const result = await pool.request()
    .input("UserId", sql.Int, normalizedUserId)
    .input("Reason", sql.NVarChar(1000), text(reason, 1000))
    .query(`
      UPDATE ${QUEUE_TABLE}
      SET [Status] = N'cancelled', [LastError] = @Reason, [LockedAt] = NULL, [UpdatedAt] = SYSUTCDATETIME()
      WHERE [UserId] = @UserId AND [IsMarketing] = 1 AND [Status] IN (N'queued', N'processing')
        AND [TriggerKey] IN (N'signed_up_no_purchase', N'cart_inactive');
      SELECT @@ROWCOUNT AS [Cancelled];
    `);
  return { cancelled: Number(result.recordset?.[0]?.Cancelled || 0) };
}

async function queueJourneyEvent({
  pool: suppliedPool,
  userId,
  email,
  name,
  eventType,
  eventAt = new Date(),
  eventKey,
  orderId,
  marketingConsent,
} = {}) {
  if (!automationEnabled()) return { queued: 0, skipped: true, reason: "disabled" };
  const normalizedUserId = validUserId(userId);
  const normalizedEmail = validEmail(email);
  const normalizedEvent = String(eventType || "").trim().toLowerCase();
  if (!normalizedUserId || !normalizedEmail || !EVENT_TYPES.has(normalizedEvent)) {
    return { queued: 0, skipped: true, reason: "invalid_event" };
  }

  const pool = suppliedPool || await getPool();
  if (!(await automationSchemaAvailable(pool))) return { queued: 0, skipped: true, schemaAvailable: false, reason: "schema_missing" };

  const journey = normalizeJourney(readCustomerEmailJourney());
  if (!isJourneyActive(journey)) return { queued: 0, skipped: true, reason: "journey_inactive" };
  const consent = await resolveMarketingConsent(pool, normalizedUserId, marketingConsent);
  if (normalizedEvent === "payment_confirmed") {
    await cancelPromotionalJourneyBranches(pool, normalizedUserId);
  }
  const eventDate = dateValue(eventAt);
  const baseEventKey = eventKeyFor({ eventType: normalizedEvent, eventKey, userId: normalizedUserId, orderId, eventAt: eventDate });
  const candidates = journey.steps.filter((step) => eventMatches(step, normalizedEvent));
  let queued = 0;
  let skipped = 0;

  for (const step of candidates) {
    const welcome = isWelcomeStep(step);
    const isMarketing = isMarketingStep(step) && !welcome;
    if (isMarketing && consent !== true) {
      skipped += 1;
      continue;
    }
    const stepKey = text(step.key || slug(step.stage, "step"), 100);
    const request = pool.request()
      .input("UserId", sql.Int, normalizedUserId)
      .input("Email", sql.NVarChar(255), normalizedEmail)
      .input("RecipientName", sql.NVarChar(250), text(name, 250) || null)
      .input("JourneyKey", sql.NVarChar(120), "customer-email-journey")
      .input("StepKey", sql.NVarChar(100), stepKey)
      .input("TriggerKey", sql.NVarChar(80), text(triggerKeysFor(step)[0], 80))
      .input("MessageType", sql.NVarChar(20), text(step.type || "Marketing", 20))
      .input("IsMarketing", sql.Bit, isMarketing)
      .input("Subject", sql.NVarChar(180), text(step.subject, 180) || "A helpful update from our store")
      .input("Body", sql.NVarChar(sql.MAX), text(step.body, 5000))
      .input("Cta", sql.NVarChar(80), text(step.cta, 80) || null)
      .input("Href", sql.NVarChar(500), text(step.href, 500) || null)
      .input("EventKey", sql.NVarChar(180), baseEventKey)
      .input("OrderId", sql.NVarChar(100), text(orderId, 100) || null)
      .input("ScheduledAt", sql.DateTime2(3), scheduleAt(step, eventDate));
    const result = await request.query(`
      DECLARE @Inserted INT = 0;
      IF NOT EXISTS (
        SELECT 1 FROM ${QUEUE_TABLE}
        WHERE [UserId] = @UserId AND [JourneyKey] = @JourneyKey AND [StepKey] = @StepKey AND [EventKey] = @EventKey
      )
      BEGIN
        INSERT INTO ${QUEUE_TABLE}
          ([UserId], [Email], [RecipientName], [JourneyKey], [StepKey], [TriggerKey], [MessageType], [IsMarketing], [Subject], [Body], [Cta], [Href], [EventKey], [OrderId], [ScheduledAt])
        VALUES
          (@UserId, @Email, @RecipientName, @JourneyKey, @StepKey, @TriggerKey, @MessageType, @IsMarketing, @Subject, @Body, @Cta, @Href, @EventKey, @OrderId, @ScheduledAt);
        SET @Inserted = @@ROWCOUNT;
      END;
      SELECT @Inserted AS [Inserted];
    `);
    queued += Number(result.recordset?.[0]?.Inserted || 0);
  }

  return { queued, skipped, schemaAvailable: true, eventType: normalizedEvent };
}

async function queueCartInactivity({ pool, userId, email, name, state } = {}) {
  const normalizedUserId = validUserId(userId);
  if (!normalizedUserId) return { queued: 0, skipped: true, reason: "guest_cart" };
  await cancelQueuedJourneySteps(pool, { userId: normalizedUserId, stepKeys: ["cart-reminder"], reason: "cart_activity_reset" });
  if (!state?.cart?.length) return { queued: 0, cancelled: true };
  return queueJourneyEvent({
    pool,
    userId: normalizedUserId,
    email,
    name,
    eventType: "cart_inactive",
    eventKey: `cart:${normalizedUserId}:v${Number(state.version || 0)}`,
    eventAt: new Date(),
  });
}

function orderEventTypeForStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("deliver") && value.includes("out")) return "out_for_delivery";
  if (value.includes("deliver")) return "order_delivered";
  if (value.includes("pack") || value.includes("ship") || value.includes("track") || value.includes("transit")) return "order_packed";
  return null;
}

async function queueOrderStatusEvent({ pool, userId, order, status, eventAt } = {}) {
  const eventType = orderEventTypeForStatus(status);
  if (!eventType || !order) return { queued: 0, skipped: true, reason: "status_not_automated" };
  const address = order.shippingAddress || {};
  return queueJourneyEvent({
    pool,
    userId,
    email: address.email,
    name: address.fullName,
    eventType,
    eventAt: eventAt || new Date(),
    eventKey: `${eventType}:${text(order.id, 100)}`,
    orderId: order.id,
  });
}

async function markQueueCancelled(pool, id, reason) {
  await pool.request()
    .input("Id", sql.BigInt, id)
    .input("Reason", sql.NVarChar(1000), text(reason, 1000))
    .query(`UPDATE ${QUEUE_TABLE} SET [Status] = N'cancelled', [LastError] = @Reason, [LockedAt] = NULL, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @Id`);
}

async function markQueueRescheduled(pool, id, scheduledAt, reason = "throttled") {
  await pool.request()
    .input("Id", sql.BigInt, id)
    .input("ScheduledAt", sql.DateTime2(3), scheduledAt)
    .input("Reason", sql.NVarChar(1000), text(reason, 1000))
    .query(`UPDATE ${QUEUE_TABLE} SET [Status] = N'queued', [ScheduledAt] = @ScheduledAt, [LockedAt] = NULL, [LastError] = @Reason, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @Id`);
}

async function markQueueSent(pool, id) {
  await pool.request()
    .input("Id", sql.BigInt, id)
    .query(`UPDATE ${QUEUE_TABLE} SET [Status] = N'sent', [SentAt] = SYSUTCDATETIME(), [LockedAt] = NULL, [LastError] = NULL, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @Id`);
}

async function markQueueFailure(pool, row, error) {
  const attempts = Number(row.Attempts || 0);
  const message = text(error?.message || error || "Email delivery failed", 1000);
  if (attempts >= MAX_ATTEMPTS) {
    await pool.request()
      .input("Id", sql.BigInt, row.Id)
      .input("Message", sql.NVarChar(1000), message)
      .query(`UPDATE ${QUEUE_TABLE} SET [Status] = N'failed', [LockedAt] = NULL, [LastError] = @Message, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @Id`);
    return;
  }
  const retryAt = new Date(Date.now() + Math.pow(2, Math.max(0, attempts - 1)) * 5 * 60_000);
  await pool.request()
    .input("Id", sql.BigInt, row.Id)
    .input("ScheduledAt", sql.DateTime2(3), retryAt)
    .input("Message", sql.NVarChar(1000), message)
    .query(`UPDATE ${QUEUE_TABLE} SET [Status] = N'queued', [ScheduledAt] = @ScheduledAt, [LockedAt] = NULL, [LastError] = @Message, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @Id`);
}

async function claimDueRows(pool, batchSize = 25) {
  const result = await pool.request().input("BatchSize", sql.Int, Math.min(100, Math.max(1, batchSize))).query(`
    ;WITH due AS (
      SELECT TOP (@BatchSize) *
      FROM ${QUEUE_TABLE} WITH (UPDLOCK, READPAST, ROWLOCK)
      WHERE ([Status] = N'queued' AND [ScheduledAt] <= SYSUTCDATETIME())
         OR ([Status] = N'processing' AND [LockedAt] <= DATEADD(MINUTE, -10, SYSUTCDATETIME()) AND [Attempts] <= ${MAX_ATTEMPTS})
      ORDER BY [ScheduledAt], [Id]
    )
    UPDATE due
    SET [Status] = N'processing', [LockedAt] = SYSUTCDATETIME(), [Attempts] = [Attempts] + 1, [UpdatedAt] = SYSUTCDATETIME()
    OUTPUT INSERTED.*;
  `);
  return result.recordset || [];
}

async function hasPaidOrder(pool, userId) {
  try {
    const result = await pool.request()
      .input("UserId", sql.NVarChar(64), String(userId))
      .query(`SELECT TOP 1 1 AS [Found] FROM [Commerce].[StorefrontOrders] WHERE [UserId] = @UserId AND LOWER(ISNULL([PaymentStatus], N'')) = N'paid'`);
    return Boolean(result.recordset?.length);
  } catch (_error) {
    return false;
  }
}

async function marketingThrottleUntil(pool, row) {
  if (!row.IsMarketing) return null;
  try {
    const result = await pool.request()
      .input("UserId", sql.Int, Number(row.UserId))
      .query(`SELECT MAX([SentAt]) AS [LastSentAt] FROM ${QUEUE_TABLE} WHERE [UserId] = @UserId AND [IsMarketing] = 1 AND [Status] = N'sent' AND [SentAt] >= DATEADD(HOUR, -24, SYSUTCDATETIME())`);
    const lastSentAt = result.recordset?.[0]?.LastSentAt ? new Date(result.recordset[0].LastSentAt) : null;
    if (!lastSentAt || Number.isNaN(lastSentAt.getTime())) return null;
    return new Date(lastSentAt.getTime() + 24 * 60 * 60_000);
  } catch (_error) {
    return null;
  }
}

async function processQueueRow(pool, row) {
  const triggerKey = String(row.TriggerKey || "");
  if (row.IsMarketing) {
    const journeyStatus = String(readCustomerEmailJourney()?.status || "Active").toLowerCase();
    if (["paused", "draft"].includes(journeyStatus)) {
      await markQueueCancelled(pool, row.Id, "journey_inactive");
      return "cancelled";
    }
    const consent = await resolveMarketingConsent(pool, row.UserId);
    if (!consent) {
      await markQueueCancelled(pool, row.Id, "marketing_consent_revoked");
      return "cancelled";
    }
    if (["signed_up_no_purchase", "cart_inactive"].includes(triggerKey) && await hasPaidOrder(pool, row.UserId)) {
      await markQueueCancelled(pool, row.Id, "customer_has_completed_an_order");
      return "cancelled";
    }
    if (triggerKey === "cart_inactive") {
      try {
        const state = await loadCartState(pool, String(row.UserId));
        if (!state.cart.length) {
          await markQueueCancelled(pool, row.Id, "cart_is_empty");
          return "cancelled";
        }
      } catch (error) {
        await markQueueFailure(pool, row, error);
        return "failed";
      }
    }
    const throttleUntil = await marketingThrottleUntil(pool, row);
    if (throttleUntil && throttleUntil > new Date()) {
      await markQueueRescheduled(pool, row.Id, throttleUntil, "one_marketing_email_per_24_hours");
      return "throttled";
    }
  }

  const result = await sendCustomerJourneyEmail({
    email: row.Email,
    name: row.RecipientName,
    step: {
      key: row.StepKey,
      stage: row.StepKey,
      triggerKey,
      triggerKeys: [triggerKey],
      type: row.MessageType,
      subject: row.Subject,
      body: row.Body,
      cta: row.Cta,
      href: row.Href,
    },
    marketing: Boolean(row.IsMarketing),
    marketingConsent: true,
  });
  if (result?.sent) {
    await markQueueSent(pool, row.Id);
    return "sent";
  }
  if (result?.skipped && ["recipient_missing", "recipient_invalid", "marketing_consent_required"].includes(result.reason)) {
    await markQueueCancelled(pool, row.Id, result.reason);
    return "cancelled";
  }
  const error = new Error(result?.reason || "Email provider did not send the message");
  await markQueueFailure(pool, row, error);
  return "failed";
}

async function runCustomerEmailAutomationOnce({ pool: suppliedPool, batchSize = 25 } = {}) {
  if (!automationEnabled()) return { claimed: 0, sent: 0, skipped: true, reason: "disabled" };
  const pool = suppliedPool || await getPool();
  if (!(await automationSchemaAvailable(pool))) return { claimed: 0, sent: 0, skipped: true, reason: "schema_missing" };
  const rows = await claimDueRows(pool, batchSize);
  const counts = { claimed: rows.length, sent: 0, cancelled: 0, throttled: 0, failed: 0 };
  for (const row of rows) {
    try {
      const result = await processQueueRow(pool, row);
      if (Object.prototype.hasOwnProperty.call(counts, result)) counts[result] += 1;
    } catch (error) {
      counts.failed += 1;
      await markQueueFailure(pool, row, error).catch(() => {});
      console.error("Customer email automation delivery failed:", error?.message || error);
    }
  }
  return counts;
}

function startCustomerEmailAutomationWorker({ pollIntervalMs } = {}) {
  if (!automationEnabled()) return { stop() {} };
  const configuredInterval = Number(pollIntervalMs || process.env.MARKETING_EMAIL_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS;
  const intervalMs = Math.min(3_600_000, Math.max(10_000, configuredInterval));
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runCustomerEmailAutomationOnce();
      if (result.claimed) console.log("Customer email automation cycle:", result);
    } catch (error) {
      console.error("Customer email automation cycle failed:", error?.message || error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  void run();
  return { stop() { clearInterval(timer); } };
}

module.exports = {
  automationSchemaAvailable,
  cancelQueuedJourneySteps,
  cancelPromotionalJourneyBranches,
  orderEventTypeForStatus,
  queueCartInactivity,
  queueJourneyEvent,
  queueOrderStatusEvent,
  runCustomerEmailAutomationOnce,
  startCustomerEmailAutomationWorker,
};
