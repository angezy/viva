"use server";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireDashboardAdmin } from "../auth";
import { sanitizeCmsHtml } from "../../../lib/contentSanitizer";
import defaultJourney from "../../../../../data/customer-email-journey.json";

const dataPath = path.join(process.cwd(), "data", "customer-email-journey.json");

const triggerDefinitions = {
  account_created: { label: "Account created", aliases: ["account created", "new customer", "new account"] },
  email_opt_in: { label: "Email marketing opt-in", aliases: ["email opt", "email opt-in", "marketing opt"] },
  signed_up_no_purchase: { label: "Signed up without a purchase", aliases: ["signed-up customer has not purchased", "has not purchased", "no purchase"] },
  cart_inactive: { label: "Cart inactive", aliases: ["cart has items", "cart inactivity", "checkout is not completed", "cart inactive"] },
  payment_confirmed: { label: "Payment confirmed", aliases: ["payment confirmed", "order created", "order received"] },
  order_packed: { label: "Order packed or tracking created", aliases: ["order is packed", "tracking number is created", "dispatch", "shipped"] },
  out_for_delivery: { label: "Out for delivery", aliases: ["out for delivery", "carrier reports the parcel is out"] },
  order_delivered: { label: "Order delivered", aliases: ["carrier reports delivery", "delivered", "order has arrived"] },
};

const validScheduleTypes = new Set(["immediate", "delay", "event"]);
const validStatuses = new Set(["Ready to activate", "Draft", "Active", "Paused"]);

const text = (value, fallback = "", max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : fallback;

const link = (value) => {
  const candidate = text(value, "/", 500);
  if (candidate.startsWith("/") || /^https?:\/\//i.test(candidate)) return candidate;
  return "/";
};

function slug(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return normalized || fallback;
}

function triggerKeys(step, index) {
  const supplied = Array.isArray(step?.triggerKeys) ? step.triggerKeys : step?.triggerKey ? [step.triggerKey] : [];
  const normalized = supplied.flatMap((value) => String(value || "") === "account_created_or_opt_in"
    ? ["account_created", "email_opt_in"]
    : [String(value || "").trim()]);
  const valid = [...new Set(normalized.filter((key) => Object.prototype.hasOwnProperty.call(triggerDefinitions, key)))];
  if (valid.length) return valid;

  const source = `${step?.stage || ""} ${step?.trigger || ""}`.toLowerCase();
  const inferred = Object.entries(triggerDefinitions)
    .filter(([, definition]) => definition.aliases.some((alias) => source.includes(alias)))
    .map(([key]) => key);
  if (inferred.length) return [...new Set(inferred)];
  return index === 0 ? ["account_created", "email_opt_in"] : ["account_created"];
}

function scheduleType(step) {
  if (validScheduleTypes.has(step?.scheduleType)) return step.scheduleType;
  const timing = String(step?.timing || "").toLowerCase();
  if (/immediate|right away|now/.test(timing)) return "immediate";
  if (/carrier milestone|status changes|when the event|when .* occurs/.test(timing)) return "event";
  return "delay";
}

function delayMinutes(step) {
  const explicit = Number(step?.delayMinutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(43_200, Math.round(explicit));
  const timing = String(step?.timing || "").toLowerCase();
  const amount = Number(timing.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  if (/day/.test(timing)) return Math.min(43_200, Math.round(amount * 1_440) || 1_440);
  if (/hour/.test(timing)) return Math.min(43_200, Math.round(amount * 60) || 60);
  if (/minute/.test(timing)) return Math.min(43_200, Math.round(amount) || 15);
  return 15;
}

function triggerLabel(keys) {
  return keys.map((key) => triggerDefinitions[key]?.label).filter(Boolean).join(" or ") || triggerDefinitions.account_created.label;
}

function timingLabel(type, minutes) {
  if (type === "immediate") return "Immediately";
  if (type === "event") return "When the event occurs";
  if (minutes && minutes % 1_440 === 0) return `${minutes / 1_440} day${minutes === 1_440 ? "" : "s"} after the trigger`;
  if (minutes && minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"} after the trigger`;
  return `${minutes || 15} minute${minutes === 1 ? "" : "s"} after the trigger`;
}

function sanitizeContent(value) {
  const input = value && typeof value === "object" ? value : {};
  const sourceSteps = Array.isArray(input.steps) ? input.steps : [];
  const sourceGuardrails = Array.isArray(input.guardrails) ? input.guardrails : [];
  const usedKeys = new Set();

  return {
    title: text(input.title, defaultJourney.title, 120) || defaultJourney.title,
    description: text(input.description, defaultJourney.description, 360) || defaultJourney.description,
    status: validStatuses.has(input.status) ? input.status : (validStatuses.has(defaultJourney.status) ? defaultJourney.status : "Draft"),
    steps: sourceSteps.slice(0, 24).map((step, index) => {
      const stage = text(step?.stage, `Touchpoint ${index + 1}`, 80) || `Touchpoint ${index + 1}`;
      const keys = triggerKeys(step, index);
      const selectedSchedule = scheduleType(step);
      const minutes = selectedSchedule === "delay" ? delayMinutes(step) : 0;
      const baseKey = slug(step?.key || stage, `step-${index + 1}`);
      let key = baseKey;
      let suffix = 2;
      while (usedKeys.has(key)) key = `${baseKey}-${suffix++}`;
      usedKeys.add(key);
      return {
        key,
        number: String(index + 1).padStart(2, "0"),
        stage,
        triggerKey: keys[0],
        triggerKeys: keys,
        trigger: triggerLabel(keys),
        scheduleType: selectedSchedule,
        delayMinutes: minutes,
        timing: timingLabel(selectedSchedule, minutes),
        type: step?.type === "Transactional" ? "Transactional" : "Marketing",
        subject: text(step?.subject, "A helpful update from Weluxo", 180),
        body: sanitizeCmsHtml(text(step?.body, "Hi there,\n\nAdd the email copy for this touchpoint.", 5000)),
        purpose: text(step?.purpose, "Keep the customer informed with a clear next step.", 300),
        cta: text(step?.cta, "Learn more", 80),
        href: link(step?.href),
      };
    }),
    guardrails: sourceGuardrails
      .slice(0, 12)
      .map((item) => text(item, "", 240))
      .filter(Boolean),
  };
}

async function ensureFile() {
  try {
    await fs.access(dataPath);
  } catch {
    await fs.writeFile(dataPath, JSON.stringify(defaultJourney, null, 2), "utf8");
  }
}

async function readContent() {
  try {
    await ensureFile();
    const raw = await fs.readFile(dataPath, "utf8");
    return sanitizeContent(JSON.parse(raw));
  } catch (error) {
    console.error("marketing content read error", error);
    return sanitizeContent(defaultJourney);
  }
}

export async function GET() {
  return NextResponse.json(await readContent());
}

export async function POST(request) {
  const authError = await requireDashboardAdmin("marketing.manage");
  if (authError) return authError;

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || !body.content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    const content = sanitizeContent(body.content);
    await ensureFile();
    await fs.writeFile(dataPath, JSON.stringify(content, null, 2), "utf8");
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    console.error("marketing content write error", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
