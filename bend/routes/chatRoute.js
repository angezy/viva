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
  return Boolean(config.token && config.adminChatId);
}

function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return Array.isArray(result.recordset) ? result.recordset : [];
}

function cleanText(value, max = 4000) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function validConversationId(value) {
  const conversationId = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{16,80}$/.test(conversationId) ? conversationId : null;
}

function visitorInput(body = {}) {
  const name = cleanText(body.name || body.customerName, 200);
  const email = cleanText(body.email || body.customerEmail, 255).toLowerCase();
  if (!name) return { error: "Your name is required" };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address" };
  return { name, email };
}

async function ensureChatTables() {
  if (!chatSchemaPromise) {
    chatSchemaPromise = (async () => {
      const pool = await getPool();
      await pool.request().query(`
        IF OBJECT_ID(N'dbo.chat_conversations', N'U') IS NULL
        BEGIN
          CREATE TABLE dbo.chat_conversations (
            conversation_id NVARCHAR(80) NOT NULL PRIMARY KEY,
            created_at DATETIME2(3) NOT NULL CONSTRAINT DF_chat_conversations_created_at DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_chat_conversations_updated_at DEFAULT SYSUTCDATETIME()
          );
        END;

        IF OBJECT_ID(N'dbo.chat_messages', N'U') IS NULL
        BEGIN
          CREATE TABLE dbo.chat_messages (
            message_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            conversation_id NVARCHAR(80) NOT NULL,
            sender_type NVARCHAR(20) NOT NULL,
            content_text NVARCHAR(4000) NOT NULL,
            telegram_message_id BIGINT NULL,
            created_at DATETIME2(3) NOT NULL CONSTRAINT DF_chat_messages_created_at DEFAULT SYSUTCDATETIME()
          );
          CREATE INDEX IX_chat_messages_conversation_id_message_id
            ON dbo.chat_messages (conversation_id, message_id);
          CREATE INDEX IX_chat_messages_telegram_message_id
            ON dbo.chat_messages (telegram_message_id);
        END;

        IF OBJECT_ID(N'dbo.chat_visitors', N'U') IS NULL
        BEGIN
          CREATE TABLE dbo.chat_visitors (
            conversation_id NVARCHAR(80) NOT NULL PRIMARY KEY,
            customer_name NVARCHAR(200) NOT NULL,
            customer_email NVARCHAR(255) NOT NULL,
            created_at DATETIME2(3) NOT NULL CONSTRAINT DF_chat_visitors_created_at DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_chat_visitors_updated_at DEFAULT SYSUTCDATETIME()
          );
          CREATE INDEX IX_chat_visitors_email ON dbo.chat_visitors (customer_email);
        END;
      `);
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
  if (!config.token || !url) return;

  try {
    await sendTelegram("setWebhook", {
      url,
      ...(config.webhookSecret ? { secret_token: config.webhookSecret } : {}),
      allowed_updates: ["message"],
    });
    console.log("Telegram webhook configured:", url);
  } catch (error) {
    console.error("Telegram webhook setup failed:", error && error.message ? error.message : error);
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
    .input("CustomerName", sql.NVarChar(200), visitor.name)
    .input("CustomerEmail", sql.NVarChar(255), visitor.email)
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
  return row ? { name: row.customer_name, email: row.customer_email } : null;
}

async function latestConversationId(pool) {
  const result = await pool.request().query("SELECT TOP 1 conversation_id FROM dbo.chat_conversations ORDER BY updated_at DESC");
  return normalizeResult(result)[0]?.conversation_id || null;
}

function notificationText(conversationId, message, visitor) {
  return [
    "New customer message on Weluxo",
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
  const visitor = visitorInput(req.body);
  if (!conversationId) return res.status(400).json({ error: "Valid conversationId is required" });
  if (visitor.error) return res.status(400).json({ error: visitor.error });

  try {
    const pool = await ensureChatTables();
    await saveVisitor(pool, conversationId, visitor);
    return res.json({ ok: true, humanSupport: isTelegramConfigured(), visitor: { name: visitor.name, email: visitor.email } });
  } catch (error) {
    console.error("POST /api/chat/start", error && error.stack ? error.stack : error);
    return res.status(500).json({ error: "Unable to start live chat" });
  }
});

router.post("/api/chat/notify", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  const message = cleanText(req.body?.message);
  const requestedVisitor = visitorInput(req.body);
  if (!conversationId || !message) return res.status(400).json({ error: "Conversation and message are required" });
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
  if (config.webhookSecret && req.headers["x-telegram-bot-api-secret-token"] !== config.webhookSecret) {
    return res.status(401).json({ error: "Invalid Telegram webhook secret" });
  }
  if (!isTelegramConfigured()) return res.json({ ok: true, configured: false });

  const message = req.body?.message;
  const telegramChatId = String(message?.chat?.id || "");
  const incomingText = cleanText(message?.text, 4000);
  if (!message || telegramChatId !== config.adminChatId || !incomingText) return res.json({ ok: true, ignored: true });

  try {
    const pool = await ensureChatTables();
    let conversationId = await conversationFromTelegramMessage(pool, message.reply_to_message?.message_id);
    let replyText = incomingText;
    const commandMatch = incomingText.match(/^\/reply(?:@[^\s]+)?\s+([a-zA-Z0-9_-]{16,80})\s+([\s\S]+)$/i);
    if (commandMatch) {
      conversationId = validConversationId(commandMatch[1]);
      replyText = cleanText(commandMatch[2]);
    } else if (!conversationId && !/^\/(start|help)\b/i.test(incomingText)) {
      conversationId = await latestConversationId(pool);
    }

    if (!conversationId || !replyText) {
      await sendTelegram("sendMessage", {
        chat_id: config.adminChatId,
        text: "Reply to a customer notification, or use /reply conversationId your answer.",
      });
      return res.json({ ok: true, ignored: true });
    }

    console.log("Telegram reply mapped to website chat", { conversationId, telegramMessageId: message.message_id });
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
