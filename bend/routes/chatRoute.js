const express = require("express");
const sql = require("mssql");
const crypto = require("crypto");
const { getPool } = require("../utils/dbConnection");

const router = express.Router();
let chatSchemaPromise = null;

function telegramConfig() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    adminChatId: String(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim(),
    webhookSecret: String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim(),
  };
}

function telegramWebhookUrl() {
  const configuredUrl = String(process.env.TELEGRAM_WEBHOOK_URL || "").trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  // A local backend cannot receive Telegram callbacks. In production, derive
  // the callback from the public frontend URL unless an explicit URL is set.
  if (process.env.NODE_ENV !== "production") return "";
  const appBaseUrl = String(process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  return appBaseUrl ? `${appBaseUrl}/api/telegram/webhook` : "";
}

function isTelegramConfigured() {
  const config = telegramConfig();
  return Boolean(config.token && config.adminChatId && config.webhookSecret);
}

function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return Array.isArray(result.recordset) ? result.recordset : [];
}

function cleanText(value, max = 4000) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function storeName() {
  return String(process.env.STORE_NAME || "Your Store").trim().slice(0, 100) || "Your Store";
}

function validConversationId(value) {
  const conversationId = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{16,80}$/.test(conversationId) ? conversationId : null;
}

function chatProofSecret() {
  return String(process.env.CHAT_SESSION_SECRET || process.env.JWT_SECRET || "").trim();
}

function createConversationProof(conversationId, issuedAt = Date.now()) {
  const secret = chatProofSecret();
  if (!secret) return null;
  const timestamp = String(issuedAt);
  const signature = crypto.createHmac("sha256", secret).update(`${conversationId}.${timestamp}`).digest("base64url");
  return `${timestamp}.${signature}`;
}

function validConversationProof(conversationId, proof) {
  const secret = chatProofSecret();
  const [timestamp, signature, extra] = String(proof || "").split(".");
  const issuedAt = Number(timestamp);
  if (!secret || extra || !Number.isSafeInteger(issuedAt) || issuedAt > Date.now() + 60000 || Date.now() - issuedAt > 24 * 60 * 60 * 1000) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${conversationId}.${timestamp}`).digest();
  let supplied;
  try { supplied = Buffer.from(signature, "base64url"); } catch (_error) { return false; }
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function conversationProofFrom(req) {
  return req.headers?.["x-chat-session-token"] || req.body?.conversationToken || req.query?.conversationToken || "";
}

function requireConversationProof(req, res, conversationId) {
  if (validConversationProof(conversationId, conversationProofFrom(req))) return true;
  res.status(403).json({ error: "Chat session proof is invalid or expired" });
  return false;
}

function validInternalChatRequest(req) {
  // The Next.js route is the only code that creates assistant messages in
  // production. Local development does not need a shared secret to exercise
  // the chat flow.
  if (process.env.NODE_ENV !== "production") return true;
  const secret = String(process.env.CHAT_INTERNAL_SECRET || "").trim();
  const supplied = String(req.headers?.["x-chat-internal-secret"] || "");
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function visitorInput(body = {}, { required = true } = {}) {
  const name = cleanText(body.name || body.customerName, 200);
  const email = cleanText(body.email || body.customerEmail, 255).toLowerCase();
  if (required && !name) return { error: "Your name is required" };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address" };
  if (required && !email) return { error: "Enter a valid email address" };
  return { name, email };
}

async function ensureChatTables() {
  if (!chatSchemaPromise) {
    chatSchemaPromise = (async () => {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT CASE WHEN OBJECT_ID(N'dbo.chat_conversations', N'U') IS NOT NULL
                          AND OBJECT_ID(N'dbo.chat_messages', N'U') IS NOT NULL
                          AND OBJECT_ID(N'dbo.chat_visitors', N'U') IS NOT NULL
                    THEN 1 ELSE 0 END AS ready;
      `);
      if (normalizeResult(result)[0]?.ready !== 1) throw new Error("Chat schema is missing; apply migration 009");
      return pool;
    })().catch((error) => {
      chatSchemaPromise = null;
      throw error;
    });
  }
  return chatSchemaPromise;
}

async function sendTelegram(method, payload) {
  const config = telegramConfig();
  if (!config.token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    const code = error?.cause?.code || error?.code || (error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR");
    throw new Error(`Telegram network request failed (${code}): ${error?.message || "fetch failed"}`);
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API failed (${response.status})`);
  }
  return data.result;
}

async function configureTelegramWebhook() {
  const config = telegramConfig();
  const url = telegramWebhookUrl();
  if (!config.token || !url || !config.webhookSecret) return;

  try {
    await sendTelegram("setWebhook", {
      url,
      ...(config.webhookSecret ? { secret_token: config.webhookSecret } : {}),
      allowed_updates: ["message"],
    });
  } catch (_error) {
    // Webhook registration is best effort; Telegram retries delivery after deployment.
  }
}

async function saveMessage(pool, { conversationId, senderType, contentText, telegramMessageId = null }) {
  await pool.request()
    .input("ConversationId", sql.NVarChar(80), conversationId)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.chat_conversations WHERE conversation_id = @ConversationId)
      BEGIN
        INSERT INTO dbo.chat_conversations (conversation_id) VALUES (@ConversationId);
      END;
    `);

  const result = await pool.request()
    .input("ConversationId", sql.NVarChar(80), conversationId)
    .input("SenderType", sql.NVarChar(20), senderType)
    .input("ContentText", sql.NVarChar(4000), contentText)
    .input("TelegramMessageId", sql.BigInt, telegramMessageId == null ? null : Number(telegramMessageId))
    .query(`
      INSERT INTO dbo.chat_messages (conversation_id, sender_type, content_text, telegram_message_id)
      OUTPUT INSERTED.message_id
      VALUES (@ConversationId, @SenderType, @ContentText, @TelegramMessageId);
    `);
  await pool.request()
    .input("ConversationId", sql.NVarChar(80), conversationId)
    .query("UPDATE dbo.chat_conversations SET updated_at = SYSUTCDATETIME() WHERE conversation_id = @ConversationId");
  return normalizeResult(result)[0]?.message_id || null;
}

async function saveVisitor(pool, conversationId, visitor) {
  await pool.request()
    .input("ConversationId", sql.NVarChar(80), conversationId)
    .input("CustomerName", sql.NVarChar(200), visitor.name || "Guest")
    .input("CustomerEmail", sql.NVarChar(255), visitor.email || "")
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.chat_conversations WHERE conversation_id = @ConversationId)
      BEGIN
        INSERT INTO dbo.chat_conversations (conversation_id) VALUES (@ConversationId);
      END;

      IF EXISTS (SELECT 1 FROM dbo.chat_visitors WHERE conversation_id = @ConversationId)
      BEGIN
        UPDATE dbo.chat_visitors
        SET customer_name = @CustomerName,
            customer_email = @CustomerEmail,
            updated_at = SYSUTCDATETIME()
        WHERE conversation_id = @ConversationId;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.chat_visitors (conversation_id, customer_name, customer_email)
        VALUES (@ConversationId, @CustomerName, @CustomerEmail);
      END;
    `);
}

async function loadVisitor(pool, conversationId) {
  const result = await pool.request()
    .input("ConversationId", sql.NVarChar(80), conversationId)
    .query("SELECT TOP 1 customer_name, customer_email FROM dbo.chat_visitors WHERE conversation_id = @ConversationId");
  const row = normalizeResult(result)[0];
  return row ? { name: String(row.customer_name || "") === "Guest" ? "" : row.customer_name, email: row.customer_email } : null;
}

async function loadConversationTranscript(pool, conversationId) {
  const result = await pool.request()
    .input("ConversationId", sql.NVarChar(80), conversationId)
    .query(`
      SELECT TOP 500 message_id, sender_type, content_text, created_at
      FROM dbo.chat_messages
      WHERE conversation_id = @ConversationId
      ORDER BY message_id ASC
    `);
  return normalizeResult(result).map((row) => ({
    id: row.message_id,
    senderType: String(row.sender_type || "customer").toLowerCase(),
    text: cleanText(row.content_text),
    createdAt: row.created_at,
  }));
}

async function latestCustomerMessageId(pool, conversationId) {
  const result = await pool.request()
    .input("ConversationId", sql.NVarChar(80), conversationId)
    .query(`
      SELECT TOP 1 message_id
      FROM dbo.chat_messages
      WHERE conversation_id = @ConversationId AND sender_type = N'customer'
      ORDER BY message_id DESC
    `);
  return normalizeResult(result)[0]?.message_id || null;
}

async function latestConversationId(pool) {
  const result = await pool.request().query("SELECT TOP 1 conversation_id FROM dbo.chat_conversations ORDER BY updated_at DESC");
  return normalizeResult(result)[0]?.conversation_id || null;
}

function notificationText(conversationId, message, visitor) {
  return [
    `New customer message on ${storeName()}`,
    `Conversation: ${conversationId}`,
    `Name: ${visitor?.name || "Not provided"}`,
    `Email: ${visitor?.email || "Not provided"}`,
    "",
    message,
    "",
    "Type your answer in the reply box below, then send it.",
  ].join("\n");
}

function telegramCustomerMessage(conversationId, message, visitor) {
  return {
    chat_id: telegramConfig().adminChatId,
    text: notificationText(conversationId, message, visitor),
    disable_web_page_preview: true,
    reply_markup: {
      force_reply: true,
      selective: true,
      input_field_placeholder: "Type your reply to the customer",
    },
  };
}

function transcriptLabel(senderType) {
  if (senderType === "agent") return "Support specialist";
  if (senderType === "assistant") return `${storeName()} assistant`;
  return "Customer";
}

function splitTelegramText(value, maxLength = 3400) {
  const text = String(value || "");
  if (!text) return [];
  const chunks = [];
  let remainder = text;
  while (remainder.length > maxLength) {
    let splitAt = remainder.lastIndexOf("\n", maxLength);
    if (splitAt < Math.floor(maxLength * 0.6)) splitAt = remainder.lastIndexOf(" ", maxLength);
    if (splitAt < 1) splitAt = maxLength;
    chunks.push(remainder.slice(0, splitAt).trim());
    remainder = remainder.slice(splitAt).trim();
  }
  if (remainder) chunks.push(remainder);
  return chunks;
}

async function sendTelegramTranscript(conversationId, visitor, transcript) {
  const heading = [
    `${storeName()} support handoff`,
    `Conversation: ${conversationId}`,
    `Name: ${visitor?.name || "Not provided"}`,
    `Email: ${visitor?.email || "Not provided"}`,
    "",
    "Chat transcript:",
  ].join("\n");
  const transcriptText = transcript.length
    ? transcript.map((message) => `${transcriptLabel(message.senderType)}: ${message.text}`).join("\n\n")
    : "Customer selected Talk to a person before sending a message.";
  const chunks = splitTelegramText(`${heading}\n${transcriptText}`);
  for (const [index, chunk] of chunks.entries()) {
    await sendTelegram("sendMessage", {
      chat_id: telegramConfig().adminChatId,
      text: chunks.length > 1 ? `${chunk}\n\n[Transcript part ${index + 1}/${chunks.length}]` : chunk,
      disable_web_page_preview: true,
    });
  }

  return sendTelegram("sendMessage", {
    chat_id: telegramConfig().adminChatId,
    text: `Reply to this message to answer the ${storeName()} conversation ${conversationId}.`,
    disable_web_page_preview: true,
    reply_markup: {
      force_reply: true,
      selective: true,
      input_field_placeholder: "Type your reply to the customer",
    },
  });
}

async function conversationFromTelegramMessage(pool, telegramMessageId) {
  if (!telegramMessageId) return null;
  const result = await pool.request()
    .input("TelegramMessageId", sql.BigInt, Number(telegramMessageId))
    .query(`
      SELECT TOP 1 conversation_id
      FROM dbo.chat_messages
      WHERE telegram_message_id = @TelegramMessageId
      ORDER BY message_id DESC
    `);
  return normalizeResult(result)[0]?.conversation_id || null;
}

router.post("/api/chat/start", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  const visitor = visitorInput(req.body, { required: true });
  if (!conversationId) return res.status(400).json({ error: "Valid conversationId is required" });
  if (visitor.error) return res.status(400).json({ error: visitor.error });

  try {
    const pool = await ensureChatTables();
    const existingVisitor = await loadVisitor(pool, conversationId);
    if (existingVisitor && !requireConversationProof(req, res, conversationId)) return;
    await saveVisitor(pool, conversationId, visitor);
    const conversationToken = createConversationProof(conversationId);
    if (!conversationToken) return res.status(503).json({ error: "Chat security is not configured" });
    return res.json({ ok: true, humanSupport: isTelegramConfigured(), conversationToken, visitor: { name: visitor.name || "", email: visitor.email || "" } });
  } catch (error) {
    console.error("POST /api/chat/start", error && error.stack ? error.stack : error);
    return res.status(500).json({ error: "Unable to start live chat" });
  }
});

// Persist both sides of the automated conversation before a handoff so the
// support specialist receives the customer’s actual chat, not a summary.
router.post("/api/chat/messages", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  const message = cleanText(req.body?.message);
  const senderType = String(req.body?.senderType || "").toLowerCase();
  if (!conversationId || !message) return res.status(400).json({ error: "Conversation and message are required" });
  if (!new Set(["customer", "assistant"]).has(senderType)) return res.status(400).json({ error: "Unsupported chat sender" });
  if (senderType === "assistant" && !validInternalChatRequest(req)) return res.status(403).json({ error: "Assistant message is not authorized" });
  if (!requireConversationProof(req, res, conversationId)) return;

  try {
    const pool = await ensureChatTables();
    const messageId = await saveMessage(pool, { conversationId, senderType, contentText: message });
    return res.status(201).json({ ok: true, messageId });
  } catch (error) {
    console.error("POST /api/chat/messages", error && error.message ? error.message : error);
    return res.status(500).json({ error: "Unable to save chat message" });
  }
});

router.post("/api/chat/handoff", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  if (!conversationId) return res.status(400).json({ error: "Valid conversationId is required" });
  if (!requireConversationProof(req, res, conversationId)) return;

  try {
    const pool = await ensureChatTables();
    const requestedVisitor = visitorInput(req.body, { required: false });
    if (requestedVisitor.error) return res.status(400).json({ error: requestedVisitor.error });
    const currentVisitor = await loadVisitor(pool, conversationId);
    const visitor = {
      name: requestedVisitor.name || currentVisitor?.name || "",
      email: requestedVisitor.email || currentVisitor?.email || "",
    };
    if (requestedVisitor.name || requestedVisitor.email) await saveVisitor(pool, conversationId, visitor);
    if (!isTelegramConfigured()) return res.json({ ok: false, humanSupport: false, reason: "not_configured" });

    const transcript = await loadConversationTranscript(pool, conversationId);
    const telegramMessage = await sendTelegramTranscript(conversationId, visitor, transcript);
    const customerMessageId = await latestCustomerMessageId(pool, conversationId);
    if (customerMessageId && telegramMessage?.message_id) {
      await pool.request()
        .input("MessageId", sql.BigInt, Number(customerMessageId))
        .input("TelegramMessageId", sql.BigInt, Number(telegramMessage.message_id))
        .query("UPDATE dbo.chat_messages SET telegram_message_id = @TelegramMessageId WHERE message_id = @MessageId");
    }
    return res.json({ ok: true, humanSupport: true });
  } catch (error) {
    console.error("POST /api/chat/handoff", error && error.stack ? error.stack : error);
    return res.status(502).json({ error: "Unable to connect support right now" });
  }
});

router.post("/api/chat/forward", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  if (!conversationId) return res.status(400).json({ error: "Valid conversationId is required" });
  if (!requireConversationProof(req, res, conversationId)) return;

  try {
    const pool = await ensureChatTables();
    if (!isTelegramConfigured()) return res.json({ ok: false, humanSupport: false, reason: "not_configured" });
    const result = await pool.request()
      .input("ConversationId", sql.NVarChar(80), conversationId)
      .query(`
        SELECT TOP 1 message_id, content_text
        FROM dbo.chat_messages
        WHERE conversation_id = @ConversationId AND sender_type = N'customer'
        ORDER BY message_id DESC
      `);
    const message = normalizeResult(result)[0];
    if (!message?.content_text) return res.status(400).json({ error: "No customer message is available to forward" });
    const telegramMessage = await sendTelegram("sendMessage", telegramCustomerMessage(conversationId, cleanText(message.content_text), await loadVisitor(pool, conversationId)));
    if (telegramMessage?.message_id) {
      await pool.request()
        .input("MessageId", sql.BigInt, Number(message.message_id))
        .input("TelegramMessageId", sql.BigInt, Number(telegramMessage.message_id))
        .query("UPDATE dbo.chat_messages SET telegram_message_id = @TelegramMessageId WHERE message_id = @MessageId");
    }
    return res.json({ ok: true, humanSupport: true });
  } catch (error) {
    console.error("POST /api/chat/forward", error && error.stack ? error.stack : error);
    return res.status(502).json({ error: "Unable to forward this message to support" });
  }
});

async function verifiedOrderForCustomer(pool, orderNumber, email) {
  const canonicalExists = await pool.request().query("SELECT OBJECT_ID(N'[Commerce].[Orders]', N'U') AS object_id");
  if (normalizeResult(canonicalExists)[0]?.object_id) {
    const canonical = await pool.request()
      .input("OrderNumber", sql.NVarChar(64), orderNumber)
      .input("Email", sql.NVarChar(255), email)
      .query(`
        SELECT TOP 1 [OrderNumber], [OrderStatus], [FulfillmentStatus], [PaymentStatus]
        FROM [Commerce].[Orders]
        WHERE ([OrderNumber] = @OrderNumber OR [LegacyOrderId] = @OrderNumber)
          AND LOWER([CustomerEmail]) = @Email
      `);
    const row = normalizeResult(canonical)[0];
    if (row) {
      return {
        orderNumber: String(row.OrderNumber || orderNumber),
        status: String(row.FulfillmentStatus || row.OrderStatus || ""),
        paymentStatus: String(row.PaymentStatus || ""),
        trackingNumber: null,
      };
    }
  }

  const storefrontExists = await pool.request().query("SELECT OBJECT_ID(N'[Commerce].[StorefrontOrders]', N'U') AS object_id");
  if (!normalizeResult(storefrontExists)[0]?.object_id) return null;
  const storefront = await pool.request()
    .input("OrderNumber", sql.NVarChar(64), orderNumber)
    .input("Email", sql.NVarChar(255), email)
    .query(`
      SELECT TOP 1 [OrderId], [Status], [PaymentStatus], [TrackingNumber]
      FROM [Commerce].[StorefrontOrders]
      WHERE [OrderId] = @OrderNumber
        AND ISJSON([ShippingAddress]) = 1
        AND LOWER(JSON_VALUE([ShippingAddress], '$.email')) = @Email
    `);
  const row = normalizeResult(storefront)[0];
  if (!row) return null;
  return {
    orderNumber: String(row.OrderId || orderNumber),
    status: String(row.Status || ""),
    paymentStatus: String(row.PaymentStatus || ""),
    trackingNumber: row.TrackingNumber ? String(row.TrackingNumber) : null,
  };
}

router.post("/api/chat/order/verify", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  const orderNumber = cleanText(req.body?.orderNumber, 64);
  const email = cleanText(req.body?.email, 255).toLowerCase();
  if (!conversationId || !orderNumber || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "A valid order number and checkout email are required" });
  }
  if (!requireConversationProof(req, res, conversationId)) return;

  try {
    const pool = await ensureChatTables();
    const order = await verifiedOrderForCustomer(pool, orderNumber, email);
    return res.json({ verified: Boolean(order), order: order || null });
  } catch (error) {
    console.error("POST /api/chat/order/verify", error && error.message ? error.message : error);
    return res.status(500).json({ error: "Unable to verify this order right now" });
  }
});

router.post("/api/chat/notify", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  const message = cleanText(req.body?.message);
  const requestedVisitor = visitorInput(req.body);
  if (!conversationId || !message) return res.status(400).json({ error: "Conversation and message are required" });
  if (!requireConversationProof(req, res, conversationId)) return;
  if (requestedVisitor.error && (req.body?.name || req.body?.email || req.body?.customerName || req.body?.customerEmail)) {
    return res.status(400).json({ error: requestedVisitor.error });
  }

  try {
    const pool = await ensureChatTables();
    const visitor = requestedVisitor.error ? await loadVisitor(pool, conversationId) : requestedVisitor;
    if (visitor) await saveVisitor(pool, conversationId, visitor);
    if (!isTelegramConfigured()) return res.json({ ok: false, humanSupport: false, reason: "not_configured" });
    const messageId = await saveMessage(pool, {
      conversationId,
      senderType: "customer",
      contentText: message,
    });
    const telegramMessage = await sendTelegram("sendMessage", telegramCustomerMessage(conversationId, message, visitor));
    if (messageId && telegramMessage?.message_id) {
      await pool.request()
        .input("MessageId", sql.BigInt, Number(messageId))
        .input("TelegramMessageId", sql.BigInt, Number(telegramMessage.message_id))
        .query("UPDATE dbo.chat_messages SET telegram_message_id = @TelegramMessageId WHERE message_id = @MessageId");
    }
    res.json({ ok: true, humanSupport: true });
  } catch (error) {
    console.error("POST /api/chat/notify", error && error.stack ? error.stack : error);
    res.status(502).json({ error: "Unable to notify Telegram" });
  }
});

// Compatibility for older frontend builds that proxy /api/chat directly to Express.
router.post("/api/chat", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId) || crypto.randomBytes(24).toString("hex");
  const message = cleanText(req.body?.message);
  const requestedVisitor = visitorInput(req.body);
  if (!message) return res.status(400).json({ error: "Message is required" });
  if (!requireConversationProof(req, res, conversationId)) return;
  if (requestedVisitor.error && (req.body?.name || req.body?.email || req.body?.customerName || req.body?.customerEmail)) return res.status(400).json({ error: requestedVisitor.error });
  if (!isTelegramConfigured()) return res.status(503).json({ error: "Telegram support is not configured" });

  try {
    const pool = await ensureChatTables();
    const visitor = requestedVisitor.error ? await loadVisitor(pool, conversationId) : requestedVisitor;
    if (visitor) await saveVisitor(pool, conversationId, visitor);
    const messageId = await saveMessage(pool, { conversationId, senderType: "customer", contentText: message });
    const telegramMessage = await sendTelegram("sendMessage", telegramCustomerMessage(conversationId, message, visitor));
    if (messageId && telegramMessage?.message_id) {
      await pool.request()
        .input("MessageId", sql.BigInt, Number(messageId))
        .input("TelegramMessageId", sql.BigInt, Number(telegramMessage.message_id))
        .query("UPDATE dbo.chat_messages SET telegram_message_id = @TelegramMessageId WHERE message_id = @MessageId");
    }
    return res.json({
      reply: "Thanks — your message has been sent to our support team. A team member will reply here shortly.",
      conversationId,
      humanSupport: true,
    });
  } catch (error) {
    console.error("POST /api/chat compatibility", error && error.stack ? error.stack : error);
    return res.status(502).json({ error: "Unable to notify Telegram" });
  }
});

router.get("/api/chat/replies", async (req, res) => {
  const conversationId = validConversationId(req.query?.conversationId);
  const afterId = Math.max(0, Number(req.query?.afterId) || 0);
  if (!conversationId) return res.status(400).json({ error: "Valid conversationId is required" });
  if (!requireConversationProof(req, res, conversationId)) return;

  try {
    const pool = await ensureChatTables();
    const result = await pool.request()
      .input("ConversationId", sql.NVarChar(80), conversationId)
      .input("AfterId", sql.BigInt, afterId)
      .query(`
        SELECT TOP 50 message_id, content_text, created_at
        FROM dbo.chat_messages
        WHERE conversation_id = @ConversationId
          AND sender_type = N'agent'
          AND message_id > @AfterId
        ORDER BY message_id ASC
      `);
    res.json({ messages: normalizeResult(result).map((row) => ({ id: row.message_id, text: row.content_text, createdAt: row.created_at })) });
  } catch (error) {
    console.error("GET /api/chat/replies", error && error.message ? error.message : error);
    res.status(500).json({ error: "Unable to load chat replies" });
  }
});

router.get("/api/chat/messages", async (req, res) => {
  const conversationId = validConversationId(req.query?.conversationId);
  if (!conversationId) return res.status(400).json({ error: "Valid conversationId is required" });
  if (!requireConversationProof(req, res, conversationId)) return;

  try {
    const pool = await ensureChatTables();
    const result = await pool.request()
      .input("ConversationId", sql.NVarChar(80), conversationId)
      .query(`
        SELECT message_id, sender_type, content_text, created_at
        FROM (
          SELECT TOP 100 message_id, sender_type, content_text, created_at
          FROM dbo.chat_messages
          WHERE conversation_id = @ConversationId
          ORDER BY message_id DESC
        ) AS recent_messages
        ORDER BY message_id ASC
      `);
    res.json({
      messages: normalizeResult(result).map((row) => ({
        id: row.message_id,
        senderType: row.sender_type,
        text: row.content_text,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/chat/messages", error && error.message ? error.message : error);
    res.status(500).json({ error: "Unable to load chat history" });
  }
});

router.delete("/api/chat/session", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  if (!conversationId) return res.status(400).json({ error: "Valid conversationId is required" });
  if (!requireConversationProof(req, res, conversationId)) return;

  try {
    const pool = await ensureChatTables();
    await pool.request()
      .input("ConversationId", sql.NVarChar(80), conversationId)
      .query(`
        DELETE FROM dbo.chat_messages WHERE conversation_id = @ConversationId;
        DELETE FROM dbo.chat_visitors WHERE conversation_id = @ConversationId;
        DELETE FROM dbo.chat_conversations WHERE conversation_id = @ConversationId;
      `);
    return res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/chat/session", error && error.message ? error.message : error);
    return res.status(500).json({ error: "Unable to clear chat session" });
  }
});

router.post("/api/telegram/webhook", async (req, res) => {
  const config = telegramConfig();
  if (!config.webhookSecret || req.headers["x-telegram-bot-api-secret-token"] !== config.webhookSecret) {
    return res.status(401).json({ error: "Invalid Telegram webhook secret" });
  }
  if (!isTelegramConfigured()) return res.json({ ok: true, configured: false });

  const message = req.body?.message;
  const telegramChatId = String(message?.chat?.id || "");
  const incomingText = cleanText(message?.text, 4000);
  if (!message || telegramChatId !== config.adminChatId || !incomingText) return res.json({ ok: true, ignored: true });

  try {
    const pool = await ensureChatTables();
    if (await conversationFromTelegramMessage(pool, message.message_id)) {
      return res.json({ ok: true, duplicate: true });
    }
    let conversationId = await conversationFromTelegramMessage(pool, message.reply_to_message?.message_id);
    let replyText = incomingText;
    const commandMatch = incomingText.match(/^\/reply(?:@[^\s]+)?\s+([a-zA-Z0-9_-]{16,80})\s+([\s\S]+)$/i);
    if (commandMatch) {
      conversationId = validConversationId(commandMatch[1]);
      replyText = cleanText(commandMatch[2]);
    }

    if (!conversationId || !replyText) {
      await sendTelegram("sendMessage", {
        chat_id: config.adminChatId,
        text: "Reply to a customer notification, or use /reply conversationId your answer.",
      });
      return res.json({ ok: true, ignored: true });
    }

    await saveMessage(pool, { conversationId, senderType: "agent", contentText: replyText, telegramMessageId: message.message_id });
    await sendTelegram("sendMessage", { chat_id: config.adminChatId, text: `Answer sent to website chat ${conversationId}.` });
    return res.json({ ok: true, conversationId });
  } catch (error) {
    console.error("POST /api/telegram/webhook", error && error.message ? error.message : error);
    return res.status(500).json({ error: "Unable to process Telegram reply" });
  }
});

if (telegramWebhookUrl()) {
  configureTelegramWebhook();
}

module.exports = router;
