const express = require("express");
const sql = require("mssql");
const crypto = require("crypto");
const { getPool } = require("../utils/dbConnection");

const router = express.Router();
let chatSchemaPromise = null;

function telegramConfig() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    adminChatId: String(process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim(),
    webhookSecret: String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim(),
  };
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

async function saveMessage(pool, { conversationId, senderType, contentText, telegramMessageId = null }) {
  const result = await pool.request()
    .input("ConversationId", sql.NVarChar(80), conversationId)
    .input("SenderType", sql.NVarChar(20), senderType)
    .input("ContentText", sql.NVarChar(4000), contentText)
    .input("TelegramMessageId", sql.BigInt, telegramMessageId == null ? null : Number(telegramMessageId))
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.chat_conversations WHERE conversation_id = @ConversationId)
      BEGIN
        INSERT INTO dbo.chat_conversations (conversation_id) VALUES (@ConversationId);
      END;

      INSERT INTO dbo.chat_messages (conversation_id, sender_type, content_text, telegram_message_id)
      OUTPUT INSERTED.message_id
      VALUES (@ConversationId, @SenderType, @ContentText, @TelegramMessageId);

      UPDATE dbo.chat_conversations
      SET updated_at = SYSUTCDATETIME()
      WHERE conversation_id = @ConversationId;
    `);
  return normalizeResult(result)[0]?.message_id || null;
}

function notificationText(conversationId, message) {
  return [
    "New customer message on Weluxo",
    `Conversation: ${conversationId}`,
    "",
    message,
    "",
    "Reply directly to this Telegram message, or use:",
    `/reply ${conversationId} your answer`,
  ].join("\n");
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

router.post("/api/chat/notify", async (req, res) => {
  const conversationId = validConversationId(req.body?.conversationId);
  const message = cleanText(req.body?.message);
  if (!conversationId || !message) return res.status(400).json({ error: "Conversation and message are required" });
  if (!isTelegramConfigured()) return res.json({ ok: false, humanSupport: false, reason: "not_configured" });

  try {
    const pool = await ensureChatTables();
    const messageId = await saveMessage(pool, {
      conversationId,
      senderType: "customer",
      contentText: message,
    });
    const telegramMessage = await sendTelegram("sendMessage", {
      chat_id: telegramConfig().adminChatId,
      text: notificationText(conversationId, message),
      disable_web_page_preview: true,
    });
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
  if (!message) return res.status(400).json({ error: "Message is required" });
  if (!isTelegramConfigured()) return res.status(503).json({ error: "Telegram support is not configured" });

  try {
    const pool = await ensureChatTables();
    const messageId = await saveMessage(pool, { conversationId, senderType: "customer", contentText: message });
    const telegramMessage = await sendTelegram("sendMessage", {
      chat_id: telegramConfig().adminChatId,
      text: notificationText(conversationId, message),
      disable_web_page_preview: true,
    });
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

module.exports = router;
