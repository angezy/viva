const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const sql = require("mssql");
const jwt = require("jsonwebtoken");
const { getPool } = require("../utils/dbConnection");
const { sendSupportTicketEmail } = require("../utils/sendpulse");

const router = express.Router();
const statuses = ["New", "Open", "In Progress", "Waiting for Customer", "Resolved", "Closed"];
const categories = ["Order", "Shipping", "Payment", "Refund", "Return", "Product Question", "Warranty", "Technical Issue", "Account", "Partnership"];
const priorities = ["Low", "Normal", "High", "Urgent"];
const senderTypes = ["customer", "agent", "ai", "system"];

function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return Array.isArray(result.recordset) ? result.recordset : [];
}

function getToken(req) {
  const authorization = req.headers?.authorization || "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return req.cookies?.viva_token || null;
}

function attachUser(req) {
  const token = getToken(req);
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: Number(decoded.sub), email: decoded.email, role: decoded.role || "user" };
    return req.user;
  } catch (_error) {
    return null;
  }
}

function optionalAuth(req, _res, next) {
  attachUser(req);
  next();
}

function requireAuth(req, res, next) {
  if (!attachUser(req)) return res.status(401).json({ error: "Authentication required" });
  next();
}

function requireAdmin(req, res, next) {
  if (!attachUser(req)) return res.status(401).json({ error: "Authentication required" });
  if (String(req.user.role).toLowerCase() !== "admin") return res.status(403).json({ error: "Administrator access required" });
  next();
}

function asJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function sanitizeHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(?:javascript|vbscript|data)\s*:/gi, "")
    .trim()
    .slice(0, 500000);
}

function toPlainText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim()
    .slice(0, 500000);
}

function parseAttachments(value) {
  return Array.isArray(value) ? value : asJson(value, []);
}

function mapMessage(row) {
  return {
    id: row.id ?? row.Id,
    ticketId: row.ticket_id ?? row.TicketId,
    senderId: row.sender_id ?? row.SenderId,
    senderType: row.sender_type ?? row.SenderType,
    visibility: row.visibility ?? row.Visibility,
    contentHtml: row.content_html ?? row.ContentHtml ?? "",
    contentText: row.content_text ?? row.ContentText ?? "",
    attachments: parseAttachments(row.attachments ?? row.Attachments),
    createdAt: row.created_at ?? row.CreatedAt,
  };
}

function mapTicket(row, messages = [], events = []) {
  if (!row) return null;
  return {
    id: row.id ?? row.Id,
    ticketNumber: row.ticket_number ?? row.TicketNumber,
    userId: row.user_id ?? row.UserId,
    orderId: row.order_id ?? row.OrderId,
    category: row.category ?? row.Category,
    priority: row.priority ?? row.Priority,
    status: row.status ?? row.Status,
    subject: row.subject ?? row.Subject,
    customerName: row.customer_name ?? row.CustomerName,
    customerEmail: row.customer_email ?? row.CustomerEmail,
    assignedAgentId: row.assigned_agent_id ?? row.AssignedAgentId,
    tags: asJson(row.tags ?? row.Tags, []),
    createdAt: row.created_at ?? row.CreatedAt,
    updatedAt: row.updated_at ?? row.UpdatedAt,
    messages,
    events,
  };
}

let supportSchemaPromise = null;
async function ensureSupportTables() {
  if (!supportSchemaPromise) {
    supportSchemaPromise = (async () => {
      const pool = await getPool();
      await pool.request().batch(`
        IF OBJECT_ID(N'[dbo].[tickets]', N'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[tickets] (
            [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tickets PRIMARY KEY,
            [ticket_number] NVARCHAR(40) NOT NULL,
            [user_id] INT NULL,
            [order_id] NVARCHAR(100) NULL,
            [category] NVARCHAR(60) NOT NULL,
            [priority] NVARCHAR(20) NOT NULL CONSTRAINT DF_tickets_priority DEFAULT N'Normal',
            [status] NVARCHAR(40) NOT NULL CONSTRAINT DF_tickets_status DEFAULT N'New',
            [subject] NVARCHAR(240) NOT NULL,
            [customer_name] NVARCHAR(200) NOT NULL,
            [customer_email] NVARCHAR(255) NOT NULL,
            [assigned_agent_id] INT NULL,
            [tags] NVARCHAR(MAX) NULL,
            [created_at] DATETIME2(3) NOT NULL CONSTRAINT DF_tickets_created_at DEFAULT SYSUTCDATETIME(),
            [updated_at] DATETIME2(3) NOT NULL CONSTRAINT DF_tickets_updated_at DEFAULT SYSUTCDATETIME()
          );
        END;
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_tickets_ticket_number' AND object_id = OBJECT_ID(N'[dbo].[tickets]'))
          CREATE UNIQUE INDEX UX_tickets_ticket_number ON [dbo].[tickets]([ticket_number]);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tickets_user_id' AND object_id = OBJECT_ID(N'[dbo].[tickets]'))
          CREATE INDEX IX_tickets_user_id ON [dbo].[tickets]([user_id], [updated_at] DESC);
        IF OBJECT_ID(N'[dbo].[ticket_messages]', N'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[ticket_messages] (
            [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ticket_messages PRIMARY KEY,
            [ticket_id] INT NOT NULL,
            [sender_id] INT NULL,
            [sender_type] NVARCHAR(20) NOT NULL,
            [visibility] NVARCHAR(20) NOT NULL CONSTRAINT DF_ticket_messages_visibility DEFAULT N'public',
            [content_html] NVARCHAR(MAX) NOT NULL,
            [content_text] NVARCHAR(MAX) NOT NULL,
            [attachments] NVARCHAR(MAX) NULL,
            [created_at] DATETIME2(3) NOT NULL CONSTRAINT DF_ticket_messages_created_at DEFAULT SYSUTCDATETIME()
          );
          CREATE INDEX IX_ticket_messages_ticket_id ON [dbo].[ticket_messages]([ticket_id], [created_at]);
        END;
        IF OBJECT_ID(N'[dbo].[ticket_events]', N'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[ticket_events] (
            [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ticket_events PRIMARY KEY,
            [ticket_id] INT NOT NULL,
            [actor_id] INT NULL,
            [action] NVARCHAR(80) NOT NULL,
            [old_value] NVARCHAR(MAX) NULL,
            [new_value] NVARCHAR(MAX) NULL,
            [created_at] DATETIME2(3) NOT NULL CONSTRAINT DF_ticket_events_created_at DEFAULT SYSUTCDATETIME()
          );
          CREATE INDEX IX_ticket_events_ticket_id ON [dbo].[ticket_events]([ticket_id], [created_at]);
        END;
      `);
      return true;
    })().catch((error) => {
      supportSchemaPromise = null;
      throw error;
    });
  }
  return supportSchemaPromise;
}

const uploadDirectory = path.join(__dirname, "..", "public", "uploads", "support");
fs.mkdirSync(uploadDirectory, { recursive: true });
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`);
    },
  }),
  limits: { files: 5, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, allowedMimeTypes.has(file.mimetype)),
});

function handleUploads(req, res, next) {
  upload.array("attachments", 5)(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Each attachment must be 10 MB or smaller" : "Invalid attachment" });
    next();
  });
}

function uploadedAttachments(req) {
  return (req.files || []).map((file) => ({
    name: file.originalname,
    type: file.mimetype,
    size: file.size,
    url: `/api/uploads/support/${file.filename}`,
  }));
}

function cleanString(value, max) {
  return String(value || "").trim().slice(0, max);
}

function validateTicketBody(body) {
  const category = categories.includes(body.category) ? body.category : "Order";
  const priority = priorities.includes(body.priority) ? body.priority : "Normal";
  const customerName = cleanString(body.customerName || body.name, 200);
  const customerEmail = cleanString(body.customerEmail || body.email, 255).toLowerCase();
  const subject = cleanString(body.subject, 240);
  const contentHtml = sanitizeHtml(body.contentHtml || body.messageHtml || body.message);
  if (!customerName || !/^\S+@\S+\.\S+$/.test(customerEmail)) return { error: "A valid customer name and email are required" };
  if (!subject) return { error: "Subject is required" };
  if (!toPlainText(contentHtml)) return { error: "Message is required" };
  return {
    customerName,
    customerEmail,
    orderId: cleanString(body.orderNumber || body.orderId, 100) || null,
    category,
    priority,
    subject,
    contentHtml,
    contentText: cleanString(body.contentText, 500000) || toPlainText(contentHtml),
  };
}

function makeTicketNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `WLX-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function loadTicket(pool, ticketId, includeInternal = false) {
  const ticketResult = await pool.request().input("TicketId", sql.Int, ticketId).query("SELECT TOP 1 * FROM [dbo].[tickets] WHERE id = @TicketId");
  const ticket = normalizeResult(ticketResult)[0];
  if (!ticket) return null;
  let messagesRequest = pool.request().input("TicketId", sql.Int, ticketId);
  const visibilityClause = includeInternal ? "" : "AND visibility = N'public'";
  const messagesResult = await messagesRequest.query(`SELECT * FROM [dbo].[ticket_messages] WHERE ticket_id = @TicketId ${visibilityClause} ORDER BY created_at ASC, id ASC`);
  let events = [];
  if (includeInternal) {
    const eventsResult = await pool.request().input("TicketId", sql.Int, ticketId).query("SELECT * FROM [dbo].[ticket_events] WHERE ticket_id = @TicketId ORDER BY created_at ASC, id ASC");
    events = normalizeResult(eventsResult).map((event) => ({ id: event.id, ticketId: event.ticket_id, actorId: event.actor_id, action: event.action, oldValue: event.old_value, newValue: event.new_value, createdAt: event.created_at }));
  }
  return mapTicket(ticket, normalizeResult(messagesResult).map(mapMessage), events);
}

async function userCanAccessTicket(pool, ticketId, user) {
  if (String(user?.role || "").toLowerCase() === "admin") return true;
  const result = await pool.request().input("TicketId", sql.Int, ticketId).query("SELECT TOP 1 user_id, customer_email FROM [dbo].[tickets] WHERE id = @TicketId");
  const row = normalizeResult(result)[0];
  if (!row) return false;
  return (Number.isFinite(Number(row.user_id)) && Number(row.user_id) === Number(user.id)) || String(row.customer_email || "").toLowerCase() === String(user.email || "").toLowerCase();
}

async function addEvent(requestable, ticketId, actorId, action, oldValue, newValue) {
  await requestable
    .input("EventTicketId", sql.Int, ticketId)
    .input("EventActorId", sql.Int, Number.isFinite(Number(actorId)) ? Number(actorId) : null)
    .input("EventAction", sql.NVarChar(80), action)
    .input("EventOldValue", sql.NVarChar(sql.MAX), oldValue == null ? null : String(oldValue))
    .input("EventNewValue", sql.NVarChar(sql.MAX), newValue == null ? null : String(newValue))
    .query("INSERT INTO [dbo].[ticket_events] (ticket_id, actor_id, action, old_value, new_value) VALUES (@EventTicketId, @EventActorId, @EventAction, @EventOldValue, @EventNewValue)");
}

async function notifyTicketEvent(pool, ticket, eventType) {
  try {
    if (eventType === "created") {
      await pool.request()
        .input("Title", sql.NVarChar(200), `New support ticket ${ticket.ticketNumber}`)
        .input("Message", sql.NVarChar(sql.MAX), `${ticket.subject} · ${ticket.customerEmail}`)
        .query(`IF OBJECT_ID(N'Notifications', N'U') IS NOT NULL INSERT INTO Notifications (Title, Message, IsRead, IsVisible) VALUES (@Title, @Message, 0, 1)`);
    }
  } catch (error) {
    console.warn("Support notification persistence failed", error.message);
  }
  if (eventType === "created") {
    try {
      await sendSupportTicketEmail(ticket);
    } catch (error) {
      // Email delivery must not undo a successfully stored ticket.
      console.warn("SendPulse support ticket email failed", error.message);
    }
  }
  if (process.env.SUPPORT_NOTIFICATION_WEBHOOK_URL) {
    try {
      await fetch(process.env.SUPPORT_NOTIFICATION_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType, ticket }) });
    } catch (error) {
      console.warn("Support notification webhook failed", error.message);
    }
  }
}

router.get("/api/support/tickets", requireAuth, async (req, res) => {
  try {
    await ensureSupportTables();
    const result = await (await getPool()).request().input("UserId", sql.Int, Number(req.user.id)).input("Email", sql.NVarChar(255), req.user.email).query(`SELECT * FROM [dbo].[tickets] WHERE user_id = @UserId OR customer_email = @Email ORDER BY updated_at DESC`);
    res.json({ tickets: normalizeResult(result).map((row) => mapTicket(row)) });
  } catch (error) {
    console.error("GET /api/support/tickets", error);
    res.status(500).json({ error: "Unable to load support tickets" });
  }
});

router.post("/api/support/tickets", optionalAuth, handleUploads, async (req, res) => {
  const input = validateTicketBody(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });
  try {
    await ensureSupportTables();
    const pool = await getPool();
    const attachments = uploadedAttachments(req);
    const ticketNumber = makeTicketNumber();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const ticketRequest = transaction.request()
        .input("TicketNumber", sql.NVarChar(40), ticketNumber)
        .input("UserId", sql.Int, req.user && Number.isFinite(Number(req.user.id)) ? Number(req.user.id) : null)
        .input("OrderId", sql.NVarChar(100), input.orderId)
        .input("Category", sql.NVarChar(60), input.category)
        .input("Priority", sql.NVarChar(20), input.priority)
        .input("Subject", sql.NVarChar(240), input.subject)
        .input("CustomerName", sql.NVarChar(200), input.customerName)
        .input("CustomerEmail", sql.NVarChar(255), input.customerEmail);
      const ticketResult = await ticketRequest.query(`INSERT INTO [dbo].[tickets] (ticket_number, user_id, order_id, category, priority, subject, customer_name, customer_email) OUTPUT INSERTED.id VALUES (@TicketNumber, @UserId, @OrderId, @Category, @Priority, @Subject, @CustomerName, @CustomerEmail)`);
      const ticketId = normalizeResult(ticketResult)[0].id;
      await transaction.request()
        .input("MessageTicketId", sql.Int, ticketId)
        .input("SenderId", sql.Int, req.user && Number.isFinite(Number(req.user.id)) ? Number(req.user.id) : null)
        .input("ContentHtml", sql.NVarChar(sql.MAX), input.contentHtml)
        .input("ContentText", sql.NVarChar(sql.MAX), input.contentText)
        .input("Attachments", sql.NVarChar(sql.MAX), JSON.stringify(attachments))
        .query("INSERT INTO [dbo].[ticket_messages] (ticket_id, sender_id, sender_type, visibility, content_html, content_text, attachments) VALUES (@MessageTicketId, @SenderId, N'customer', N'public', @ContentHtml, @ContentText, @Attachments)");
      await addEvent(transaction.request(), ticketId, req.user?.id, "created", null, "New");
      await transaction.commit();
      const ticket = await loadTicket(pool, ticketId, false);
      await notifyTicketEvent(pool, ticket, "created");
      return res.status(201).json({ ticket });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("POST /api/support/tickets", error);
    res.status(500).json({ error: "Unable to create support ticket" });
  }
});

router.get("/api/support/tickets/:ticketId", requireAuth, async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId) || ticketId < 1) return res.status(400).json({ error: "Invalid ticket id" });
  try {
    await ensureSupportTables();
    const pool = await getPool();
    if (!(await userCanAccessTicket(pool, ticketId, req.user))) return res.status(403).json({ error: "You do not have access to this ticket" });
    const ticket = await loadTicket(pool, ticketId, String(req.user.role).toLowerCase() === "admin");
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json({ ticket });
  } catch (error) {
    console.error("GET /api/support/tickets/:ticketId", error);
    res.status(500).json({ error: "Unable to load support ticket" });
  }
});

router.post("/api/support/tickets/:ticketId/messages", requireAuth, handleUploads, async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  const contentHtml = sanitizeHtml(req.body?.contentHtml || req.body?.message || "");
  const contentText = cleanString(req.body?.contentText, 500000) || toPlainText(contentHtml);
  if (!Number.isInteger(ticketId) || ticketId < 1) return res.status(400).json({ error: "Invalid ticket id" });
  if (!contentText) return res.status(400).json({ error: "Message is required" });
  try {
    await ensureSupportTables();
    const pool = await getPool();
    if (!(await userCanAccessTicket(pool, ticketId, req.user))) return res.status(403).json({ error: "You do not have access to this ticket" });
    const isAdmin = String(req.user.role).toLowerCase() === "admin";
    const visibility = isAdmin && req.body?.visibility === "internal" ? "internal" : "public";
    const senderType = isAdmin ? (req.body?.senderType === "ai" ? "ai" : "agent") : "customer";
    const attachments = uploadedAttachments(req);
    await pool.request()
      .input("TicketId", sql.Int, ticketId)
      .input("SenderId", sql.Int, Number(req.user.id))
      .input("SenderType", sql.NVarChar(20), senderType)
      .input("Visibility", sql.NVarChar(20), visibility)
      .input("ContentHtml", sql.NVarChar(sql.MAX), contentHtml)
      .input("ContentText", sql.NVarChar(sql.MAX), contentText)
      .input("Attachments", sql.NVarChar(sql.MAX), JSON.stringify(attachments))
      .query("INSERT INTO [dbo].[ticket_messages] (ticket_id, sender_id, sender_type, visibility, content_html, content_text, attachments) VALUES (@TicketId, @SenderId, @SenderType, @Visibility, @ContentHtml, @ContentText, @Attachments); UPDATE [dbo].[tickets] SET updated_at = SYSUTCDATETIME() WHERE id = @TicketId");
    await addEvent(pool.request(), ticketId, req.user.id, visibility === "internal" ? "internal_note_added" : "message_added", null, senderType);
    const ticket = await loadTicket(pool, ticketId, isAdmin);
    res.status(201).json({ ticket });
  } catch (error) {
    console.error("POST /api/support/tickets/:ticketId/messages", error);
    res.status(500).json({ error: "Unable to send ticket message" });
  }
});

router.get("/api/support/admin/tickets", requireAdmin, async (req, res) => {
  try {
    await ensureSupportTables();
    const search = cleanString(req.query.search, 120);
    const status = statuses.includes(req.query.status) ? req.query.status : null;
    const priority = priorities.includes(req.query.priority) ? req.query.priority : null;
    const category = categories.includes(req.query.category) ? req.query.category : null;
    let request = (await getPool()).request().input("Search", sql.NVarChar(120), search ? `%${search}%` : null).input("Status", sql.NVarChar(40), status).input("Priority", sql.NVarChar(20), priority).input("Category", sql.NVarChar(60), category);
    const result = await request.query(`SELECT TOP 200 * FROM [dbo].[tickets] WHERE (@Search IS NULL OR ticket_number LIKE @Search OR subject LIKE @Search OR customer_email LIKE @Search OR customer_name LIKE @Search) AND (@Status IS NULL OR status = @Status) AND (@Priority IS NULL OR priority = @Priority) AND (@Category IS NULL OR category = @Category) ORDER BY updated_at DESC`);
    res.json({ tickets: normalizeResult(result).map((row) => mapTicket(row)) });
  } catch (error) {
    console.error("GET /api/support/admin/tickets", error);
    res.status(500).json({ error: "Unable to load admin tickets" });
  }
});

router.get("/api/support/admin/tickets/:ticketId", requireAdmin, async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId) || ticketId < 1) return res.status(400).json({ error: "Invalid ticket id" });
  try {
    await ensureSupportTables();
    const pool = await getPool();
    const ticket = await loadTicket(pool, ticketId, true);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    let customer = null;
    if (Number.isFinite(Number(ticket.userId))) {
      const result = await pool.request().input("UserId", sql.Int, Number(ticket.userId)).query("SELECT TOP 1 UserID, Username, Email, Role, CreatedAt, LastLogin FROM User_tbl WHERE UserID = @UserId");
      customer = normalizeResult(result)[0] || null;
    }
    let orders = [];
    if (Number.isFinite(Number(ticket.userId))) {
      const result = await pool.request().input("UserId", sql.Int, Number(ticket.userId)).query("SELECT TOP 20 OrderId, PlacedAt, Total, Status FROM Orders_tbl WHERE UserId = @UserId ORDER BY PlacedAt DESC");
      orders = normalizeResult(result);
    }
    let previousTickets = [];
    if (Number.isFinite(Number(ticket.userId))) {
      const result = await pool.request().input("UserId", sql.Int, Number(ticket.userId)).input("TicketId", sql.Int, ticketId).query("SELECT TOP 20 * FROM [dbo].[tickets] WHERE user_id = @UserId AND id <> @TicketId ORDER BY updated_at DESC");
      previousTickets = normalizeResult(result).map((row) => mapTicket(row));
    } else {
      const result = await pool.request().input("Email", sql.NVarChar(255), ticket.customerEmail).input("TicketId", sql.Int, ticketId).query("SELECT TOP 20 * FROM [dbo].[tickets] WHERE customer_email = @Email AND id <> @TicketId ORDER BY updated_at DESC");
      previousTickets = normalizeResult(result).map((row) => mapTicket(row));
    }
    res.json({ ticket, customer, orders, previousTickets });
  } catch (error) {
    console.error("GET /api/support/admin/tickets/:ticketId", error);
    res.status(500).json({ error: "Unable to load admin ticket" });
  }
});

router.patch("/api/support/admin/tickets/:ticketId", requireAdmin, async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId) || ticketId < 1) return res.status(400).json({ error: "Invalid ticket id" });
  try {
    await ensureSupportTables();
    const pool = await getPool();
    const existingResult = await pool.request().input("TicketId", sql.Int, ticketId).query("SELECT TOP 1 * FROM [dbo].[tickets] WHERE id = @TicketId");
    const existing = normalizeResult(existingResult)[0];
    if (!existing) return res.status(404).json({ error: "Ticket not found" });
    const changes = [];
    let request = pool.request().input("TicketId", sql.Int, ticketId);
    if (statuses.includes(req.body?.status) && req.body.status !== existing.status) { request = request.input("Status", sql.NVarChar(40), req.body.status); changes.push(["status_changed", existing.status, req.body.status]); }
    if (priorities.includes(req.body?.priority) && req.body.priority !== existing.priority) { request = request.input("Priority", sql.NVarChar(20), req.body.priority); changes.push(["priority_changed", existing.priority, req.body.priority]); }
    if (categories.includes(req.body?.category) && req.body.category !== existing.category) { request = request.input("Category", sql.NVarChar(60), req.body.category); changes.push(["category_changed", existing.category, req.body.category]); }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "assignedAgentId")) { const agentId = req.body.assignedAgentId ? Number(req.body.assignedAgentId) : null; request = request.input("AssignedAgentId", sql.Int, Number.isFinite(agentId) ? agentId : null); changes.push(["assignment_changed", existing.assigned_agent_id, agentId]); }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "tags")) { const tags = Array.isArray(req.body.tags) ? req.body.tags.map((tag) => cleanString(tag, 40)).filter(Boolean).slice(0, 30) : []; request = request.input("Tags", sql.NVarChar(sql.MAX), JSON.stringify(tags)); changes.push(["tags_changed", existing.tags, JSON.stringify(tags)]); }
    if (!changes.length) return res.json({ ticket: mapTicket(existing) });
    const fields = ["updated_at = SYSUTCDATETIME()"];
    if (statuses.includes(req.body?.status) && req.body.status !== existing.status) fields.push("status = @Status");
    if (priorities.includes(req.body?.priority) && req.body.priority !== existing.priority) fields.push("priority = @Priority");
    if (categories.includes(req.body?.category) && req.body.category !== existing.category) fields.push("category = @Category");
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "assignedAgentId")) fields.push("assigned_agent_id = @AssignedAgentId");
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "tags")) fields.push("tags = @Tags");
    await request.query(`UPDATE [dbo].[tickets] SET ${fields.join(", ")} WHERE id = @TicketId`);
    for (const [action, oldValue, newValue] of changes) await addEvent(pool.request(), ticketId, req.user.id, action, oldValue, newValue);
    res.json({ ticket: await loadTicket(pool, ticketId, true) });
  } catch (error) {
    console.error("PATCH /api/support/admin/tickets/:ticketId", error);
    res.status(500).json({ error: "Unable to update ticket" });
  }
});

module.exports = router;
