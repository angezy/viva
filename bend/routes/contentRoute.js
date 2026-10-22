const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { requirePermission } = require("../utils/rbac");

const router = express.Router();
const dataDir = path.join(__dirname, "..", "..", "fend", "data");
const contentFiles = new Set([
  "home",
  "blog",
  "about",
  "why-weluxo",
  "how-it-works",
  "faq",
  "help-center",
  "shop",
  "site-chrome",
  "privacy-policy",
  "terms-conditions",
  "shipping-policy",
  "return-refund-policy",
]);

function dataPath(name) {
  return contentFiles.has(name) ? path.join(dataDir, `${name}.json`) : null;
}

async function readContent(name) {
  const file = dataPath(name);
  if (!file) return null;
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    console.error(`Content read failed for ${name}:`, error.message);
    return null;
  }
}

async function writeContent(name, content) {
  const file = dataPath(name);
  if (!file) return false;
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return true;
}

// The production proxy sends /api/* to Express. These routes are the
// canonical backend path for the frontend-managed content files.
router.get("/api/dashboard/:name", async (req, res, next) => {
  if (!contentFiles.has(req.params.name)) return next();
  const content = await readContent(req.params.name);
  if (content === null) return res.status(404).json({ error: "Content not found" });
  return res.set("Cache-Control", "no-store").json(content);
});

router.get("/api/dashboard/legal/:slug", async (req, res) => {
  const content = await readContent(req.params.slug);
  if (content === null) return res.status(404).json({ error: "Legal page not found" });
  return res.set("Cache-Control", "no-store").json(content);
});

router.post("/api/dashboard/:name", requirePermission("content.manage", "dashboardUser"), async (req, res, next) => {
  if (!contentFiles.has(req.params.name) || req.params.name === "site-chrome") return next();
  const content = req.body?.content;
  if (!content || typeof content !== "object") return res.status(400).json({ error: "Missing content" });
  await writeContent(req.params.name, content);
  return res.json({ ok: true, content });
});

router.post("/api/dashboard/site-chrome", requirePermission("content.manage", "dashboardUser"), async (req, res) => {
  const content = req.body;
  if (!content || typeof content !== "object" || !content.header || !content.footer) {
    return res.status(400).json({ error: "Missing site chrome content" });
  }
  await writeContent("site-chrome", content);
  return res.json({ ok: true, content });
});

router.get("/api/site-chrome", async (_req, res) => {
  const content = await readContent("site-chrome");
  if (content === null) return res.status(404).json({ error: "Site chrome not found" });
  return res.set("Cache-Control", "no-store").json(content);
});

router.post("/api/dashboard/legal/:slug", requirePermission("content.manage", "dashboardUser"), async (req, res) => {
  if (!contentFiles.has(req.params.slug)) return res.status(404).json({ error: "Legal page not found" });
  const content = req.body?.content;
  if (!content || typeof content !== "object") return res.status(400).json({ error: "Missing content" });
  await writeContent(req.params.slug, content);
  return res.json({ ok: true, content });
});

router.get("/api/dashboard/ai-knowledge", async (_req, res) => {
  try {
    const content = JSON.parse(await fs.readFile(path.join(dataDir, "ai-knowledge.json"), "utf8"));
    return res.set("Cache-Control", "no-store").json(content);
  } catch (error) {
    console.error("AI knowledge read failed:", error.message);
    return res.status(404).json({ error: "AI knowledge not found" });
  }
});

router.put("/api/dashboard/ai-knowledge", requirePermission("content.manage", "dashboardUser"), async (req, res) => {
  const content = req.body;
  if (!content || typeof content !== "object" || !Array.isArray(content.entries)) {
    return res.status(400).json({ error: "Knowledge content is required" });
  }
  await writeContent("ai-knowledge", content);
  return res.json({ ok: true, knowledge: content });
});

router.get("/api/chat/config", async (_req, res) => {
  const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Your Store";
  const value = (name, fallback) => String(process.env[name] || fallback).trim();
  return res.json({
    enabled: process.env.CHAT_ENABLED !== "false",
    title: value("CHAT_TITLE", `${storeName} AI Concierge`),
    subtitle: value("CHAT_SUBTITLE", `Answers from the ${storeName} help library`),
    greeting: value("CHAT_GREETING", `Hi - I'm the ${storeName} AI Concierge. What can I help you find today?`),
    placeholder: value("CHAT_PLACEHOLDER", "Ask about orders, shipping..."),
    triggerLabel: value("CHAT_TRIGGER_LABEL", "Open live chat"),
    thinking: value("CHAT_THINKING", "Thinking..."),
    fallback: value("CHAT_FALLBACK", "I could not find an exact answer in the help library."),
    error: value("CHAT_ERROR", "I'm temporarily unavailable. Please try again."),
  });
});

module.exports = router;
