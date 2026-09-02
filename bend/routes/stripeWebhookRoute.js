const crypto = require("crypto");
const sql = require("mssql");
const { getPool } = require("../utils/dbConnection");
const { recordSecurityEvent } = require("../utils/securityAudit");

const PAID_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "payment_intent.succeeded",
]);
const RELEASE_EVENT_TYPES = new Set([
  "checkout.session.expired",
  "checkout.session.async_payment_failed",
]);
const PAYMENT_FAILURE_EVENT_TYPES = new Set(["payment_intent.payment_failed"]);
const REFUND_EVENT_TYPES = new Set(["charge.refunded", "charge.refund.updated"]);

function verifyStripeSignature(payload, signatureHeader, secret, toleranceSeconds = 300, now = Date.now()) {
  if (!Buffer.isBuffer(payload) || !signatureHeader || !secret) return false;
  const parts = String(signatureHeader).split(",").map((part) => part.trim().split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(payload).digest();
  return signatures.some((value) => {
    let supplied;
    try { supplied = Buffer.from(value, "hex"); } catch (_error) { return false; }
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  });
}

function stripeEventDisposition(event) {
  const type = String(event?.type || "");
  if (PAID_EVENT_TYPES.has(type)) return "paid";
  if (RELEASE_EVENT_TYPES.has(type)) return "release";
  if (PAYMENT_FAILURE_EVENT_TYPES.has(type)) return "payment_failed";
  if (REFUND_EVENT_TYPES.has(type)) return "refunded";
  return "ignore";
}

function stripeEventIsPaid(event) {
  const object = event?.data?.object || {};
  if (String(event?.type || "").startsWith("checkout.session.")) {
    return object.payment_status === "paid";
  }
  return object.status === "succeeded";
}

function stripeEventAmountCents(event) {
  const object = event?.data?.object || {};
  if (event?.type === "checkout.session.completed" || event?.type === "checkout.session.async_payment_succeeded") {
    return Number(object.amount_total);
  }
  return Number(object.amount_received ?? object.amount);
}

async function releaseReservations(transaction, checkoutId, finalStatus) {
  const request = new sql.Request(transaction)
    .input("CheckoutId", sql.UniqueIdentifier, checkoutId)
    .input("FinalStatus", sql.NVarChar(30), finalStatus);
  await request.query(`
    UPDATE variants WITH (UPDLOCK, ROWLOCK)
    SET variants.[AvailableQuantity] = variants.[AvailableQuantity] + reservations.[quantity],
        variants.[UpdatedAt] = SYSUTCDATETIME()
    FROM [Commerce].[ProductVariants] variants
    INNER JOIN [Commerce].[InventoryReservations] reservations ON reservations.[variant_id] = variants.[Id]
    WHERE reservations.[checkout_id] = @CheckoutId AND reservations.[reservation_status] = N'Active';

    UPDATE [Commerce].[InventoryReservations]
    SET [reservation_status] = N'Released', [updated_at] = SYSUTCDATETIME()
    WHERE [checkout_id] = @CheckoutId AND [reservation_status] = N'Active';

    UPDATE [Commerce].[SecureCheckoutSessions]
    SET [checkout_status] = @FinalStatus, [payment_status] = N'Failed', [updated_at] = SYSUTCDATETIME()
    WHERE [id] = @CheckoutId AND [payment_status] <> N'Paid';
  `);
}

async function stripeWebhook(req, res) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const signature = req.headers["stripe-signature"];
  if (!verifyStripeSignature(req.body, signature, secret)) {
    await recordSecurityEvent({ eventType: "webhook.stripe_invalid_signature", severity: "high", actor: req.ip });
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  let event;
  try { event = JSON.parse(req.body.toString("utf8")); } catch (_error) {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }
  if (!/^evt_[A-Za-z0-9]+$/.test(String(event?.id || "")) || !event?.type || !event?.data?.object) {
    return res.status(400).json({ error: "Invalid Stripe event" });
  }

  const payloadHash = crypto.createHash("sha256").update(req.body).digest("hex");
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const eventResult = await new sql.Request(transaction)
      .input("Provider", sql.NVarChar(40), "stripe")
      .input("EventId", sql.NVarChar(255), event.id)
      .input("EventType", sql.NVarChar(120), event.type)
      .input("PayloadHash", sql.Char(64), payloadHash)
      .query(`
        IF EXISTS (SELECT 1 FROM [Integration].[WebhookEvents] WITH (UPDLOCK, HOLDLOCK) WHERE [provider] = @Provider AND [event_id] = @EventId)
          SELECT TOP 1 CAST(1 AS BIT) AS [duplicate], [payload_hash] FROM [Integration].[WebhookEvents] WITH (UPDLOCK, HOLDLOCK) WHERE [provider] = @Provider AND [event_id] = @EventId;
        ELSE
        BEGIN
          INSERT INTO [Integration].[WebhookEvents] ([provider], [event_id], [event_type], [payload_hash])
          VALUES (@Provider, @EventId, @EventType, @PayloadHash);
          SELECT CAST(0 AS BIT) AS [duplicate], @PayloadHash AS [payload_hash];
        END;
      `);
    if (eventResult.recordset?.[0]?.duplicate) {
      const previousPayloadHash = String(eventResult.recordset[0].payload_hash || "");
      await transaction.commit();
      if (previousPayloadHash && previousPayloadHash !== payloadHash) {
        await recordSecurityEvent({ pool, eventType: "webhook.stripe_event_collision", severity: "critical", resourceType: "stripe_event", resourceId: event.id, metadata: { eventType: event.type } });
        return res.status(409).json({ error: "Stripe event ID was already received with a different payload" });
      }
      await recordSecurityEvent({ pool, eventType: "webhook.stripe_replay", severity: "warning", resourceType: "stripe_event", resourceId: event.id, metadata: { eventType: event.type } });
      return res.json({ received: true, duplicate: true });
    }

    const object = event.data.object;
    const providerPaymentId = String(object.payment_intent || (String(object.object || "") === "payment_intent" ? object.id : ""));
    const checkoutResult = await new sql.Request(transaction)
      .input("ProviderSessionId", sql.NVarChar(255), String(object.id || ""))
      .input("ProviderPaymentId", sql.NVarChar(255), providerPaymentId)
      .input("CheckoutId", sql.NVarChar(64), String(object.metadata?.checkout_id || ""))
      .query(`
        SELECT TOP 1 * FROM [Commerce].[SecureCheckoutSessions] WITH (UPDLOCK, HOLDLOCK)
        WHERE [provider_session_id] = @ProviderSessionId
           OR (@ProviderPaymentId <> N'' AND [provider_payment_id] = @ProviderPaymentId)
           OR CONVERT(NVARCHAR(64), [id]) = @CheckoutId;
      `);
    const checkout = checkoutResult.recordset?.[0] || null;

    const disposition = stripeEventDisposition(event);
    if (disposition === "paid") {
      if (!checkout) throw new Error("Checkout session was not found");
      // checkout.session.completed can be emitted while an asynchronous payment
      // is still pending. A later succeeded event is authoritative in that case.
      if (stripeEventIsPaid(event)) {
        const checkoutStatus = String(checkout.checkout_status || "").toLowerCase();
        const paymentStatus = String(checkout.payment_status || "").toLowerCase();
        if (checkoutStatus !== "expired" && !["failed", "refunded"].includes(paymentStatus)) {
          if (stripeEventAmountCents(event) !== Math.round(Number(checkout.total_amount) * 100)) throw new Error("Stripe amount does not match checkout");
          if (String(object.currency || "").toUpperCase() !== String(checkout.currency).toUpperCase()) throw new Error("Stripe currency does not match checkout");
          await new sql.Request(transaction)
            .input("CheckoutId", sql.UniqueIdentifier, checkout.id)
            .input("ProviderPaymentId", sql.NVarChar(255), providerPaymentId)
            .query(`
            UPDATE [Commerce].[SecureCheckoutSessions]
            SET [checkout_status] = N'Paid', [payment_status] = N'Paid',
                [provider_payment_id] = COALESCE(NULLIF(@ProviderPaymentId, N''), [provider_payment_id]),
                [paid_at] = COALESCE([paid_at], SYSUTCDATETIME()), [updated_at] = SYSUTCDATETIME()
            WHERE [id] = @CheckoutId;
            UPDATE [Commerce].[InventoryReservations]
            SET [reservation_status] = N'Consumed', [updated_at] = SYSUTCDATETIME()
            WHERE [checkout_id] = @CheckoutId AND [reservation_status] = N'Active';
          `);
        }
      }
    } else if (disposition === "release" && checkout) {
      await releaseReservations(transaction, checkout.id, event.type.endsWith("expired") ? "Expired" : "Failed");
    } else if (disposition === "payment_failed" && checkout) {
      // A card PaymentIntent can fail while the hosted Checkout session remains
      // open for a retry. Keep the reservation until Stripe expires the session.
      await new sql.Request(transaction).input("CheckoutId", sql.UniqueIdentifier, checkout.id).query(`
        UPDATE [Commerce].[SecureCheckoutSessions]
        SET [checkout_status] = N'PaymentFailed', [updated_at] = SYSUTCDATETIME()
        WHERE [id] = @CheckoutId AND [payment_status] = N'Pending' AND [checkout_status] NOT IN (N'Expired', N'Completed');
      `);
    } else if (disposition === "refunded" && checkout) {
      await new sql.Request(transaction)
        .input("CheckoutId", sql.UniqueIdentifier, checkout.id)
        .input("ProviderEventId", sql.NVarChar(255), event.id)
        .query(`
        UPDATE [Commerce].[SecureCheckoutSessions]
        SET [payment_status] = N'Refunded', [refund_inventory_status] = COALESCE([refund_inventory_status], N'ReviewRequired'), [updated_at] = SYSUTCDATETIME()
        WHERE [id] = @CheckoutId;
        IF NOT EXISTS (SELECT 1 FROM [Commerce].[InventoryAdjustments] WHERE [provider_event_id] = @ProviderEventId)
          INSERT INTO [Commerce].[InventoryAdjustments] ([checkout_id], [provider_event_id], [decision], [reason])
          VALUES (@CheckoutId, @ProviderEventId, N'ReviewRequired', N'Stripe refund requires fulfillment-aware inventory decision');
      `);
    }

    await new sql.Request(transaction)
      .input("EventId", sql.NVarChar(255), event.id)
      .query("UPDATE [Integration].[WebhookEvents] SET [processing_status] = N'Processed', [processed_at] = SYSUTCDATETIME() WHERE [provider] = N'stripe' AND [event_id] = @EventId");
    await transaction.commit();
    await recordSecurityEvent({ pool, eventType: "webhook.stripe_processed", actor: null, resourceType: "stripe_event", resourceId: event.id, metadata: { eventType: event.type, disposition } });
    return res.json({ received: true });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error("Stripe webhook processing failed:", error?.message || error);
    await recordSecurityEvent({ pool, eventType: "webhook.stripe_failed", severity: "high", resourceType: "stripe_event", resourceId: event?.id, metadata: { eventType: String(event?.type || "unknown"), code: String(error?.code || error?.number || "processing_error") } });
    return res.status(500).json({ error: "Webhook could not be processed" });
  }
}

module.exports = {
  stripeEventAmountCents,
  stripeEventDisposition,
  stripeEventIsPaid,
  stripeWebhook,
  verifyStripeSignature,
};
