const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { requirePermission } = require("../utils/rbac");

const router = express.Router();
const dataDir = path.join(__dirname, "..", "..", "fend", "data");
const CONTENT_FILES = new Set([
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

router.get("/api/chat/config", async (_req, res) => {
  const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Your Store";
  const text = (name, fallback) => String(process.env[name] || fallback).trim();
  res.json({
    enabled: process.env.CHAT_ENABLED !== "false",
    title: text("CHAT_TITLE", `${storeName} AI Concierge`),
    subtitle: text("CHAT_SUBTITLE", `Answers from the ${storeName} help library`),
    greeting: text("CHAT_GREETING", `Hi - I'm the ${storeName} AI Concierge. What can I help you find today?`),
    placeholder: text("CHAT_PLACEHOLDER", "Ask about orders, shipping..."),
    triggerLabel: text("CHAT_TRIGGER_LABEL", "Open live chat"),
    thinking: text("CHAT_THINKING", "Thinking..."),
    fallback: text("CHAT_FALLBACK", "I could not find an exact answer in the help library."),
    error: text("CHAT_ERROR", "I'm temporarily unavailable. Please try again."),
  });
});

function fileFor(name) {
  return CONTENT_FILES.has(name) ? path.join(dataDir, `${name}.json`) : null;
}

async function readContent(name) {
  const file = fileFor(name);
  if (!file) return null;
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    console.error(`content read error (${name})`, error.message);
    return null;
  }
}

async function writeContent(name, content) {
  const file = fileFor(name);
  if (!file) return false;
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return true;
}

// These endpoints are also registered in the Next frontend. The production
// reverse proxy currently sends /api/* to Express, so keep the content API
// available here as well.
router.get("/api/dashboard/:name", async (req, res, next) => {
  if (!CONTENT_FILES.has(req.params.name)) return next();
  const content = await readContent(req.params.name);
  if (content === null) return res.status(404).json({ error: "Content not found" });
  res.set("Cache-Control", "no-store").json(content);
});

router.get("/api/dashboard/legal/:slug", async (req, res) => {
  const content = await readContent(req.params.slug);
  if (content === null) return res.status(404).json({ error: "Legal page not found" });
  res.set("Cache-Control", "no-store").json(content);
});

router.post("/api/dashboard/:name", requirePermission("content.manage", "dashboardUser"), async (req, res, next) => {
  if (!CONTENT_FILES.has(req.params.name) || req.params.name === "site-chrome") return next();
  const content = req.body?.content;
  if (!content || typeof content !== "object") return res.status(400).json({ error: "Missing content" });
  await writeContent(req.params.name, content);
  res.json({ ok: true, content });
});

router.post("/api/dashboard/site-chrome", requirePermission("content.manage", "dashboardUser"), async (req, res) => {
  const content = req.body;
  if (!content || typeof content !== "object" || !content.header || !content.footer) {
    return res.status(400).json({ error: "Missing site chrome content" });
  }
  await writeContent("site-chrome", content);
  return res.json({ ok: true, content });
});

router.post("/api/dashboard/legal/:slug", requirePermission("content.manage", "dashboardUser"), async (req, res) => {
  if (!CONTENT_FILES.has(req.params.slug) || !req.params.slug.endsWith("policy") && req.params.slug !== "terms-conditions") {
    return res.status(404).json({ error: "Legal page not found" });
  }
  const content = req.body?.content;
  if (!content || typeof content !== "object") return res.status(400).json({ error: "Missing content" });
  await writeContent(req.params.slug, content);
  return res.json({ ok: true, content });
});

module.exports = router;
