const fs = require("fs");
const path = require("path");

const TRIGGER_DEFINITIONS = {
  account_created: { label: "Account created", aliases: ["account created", "new customer", "new account"] },
  email_opt_in: { label: "Email marketing opt-in", aliases: ["email opt", "email opt-in", "marketing opt"] },
  signed_up_no_purchase: { label: "Signed up without a purchase", aliases: ["signed-up customer has not purchased", "has not purchased", "no purchase"] },
  cart_inactive: { label: "Cart inactive", aliases: ["cart has items", "cart inactivity", "checkout is not completed", "cart inactive"] },
  payment_confirmed: { label: "Payment confirmed", aliases: ["payment confirmed", "order created", "order received"] },
  order_packed: { label: "Order packed or tracking created", aliases: ["order is packed", "tracking number is created", "dispatch", "shipped"] },
  out_for_delivery: { label: "Out for delivery", aliases: ["out for delivery", "carrier reports the parcel is out"] },
  order_delivered: { label: "Order delivered", aliases: ["carrier reports delivery", "delivered", "order has arrived"] },
};

const SCHEDULE_DEFINITIONS = {
  immediate: { label: "Immediately" },
  delay: { label: "After a delay" },
  event: { label: "When the event occurs" },
};

const DEFAULT_WELCOME_STEP = {
  key: "welcome",
  stage: "Welcome",
  triggerKey: "account_created",
  triggerKeys: ["account_created", "email_opt_in"],
  trigger: "Account created or email marketing opt-in",
  scheduleType: "immediate",
  delayMinutes: 0,
  timing: "Immediately",
  type: "Marketing",
  subject: "Welcome to our store",
  body: "Hi there,\n\nThanks for joining us. We are glad to have you here. Explore the store whenever you are ready.\n\nThe team",
  purpose: "Welcome a new customer and introduce the store.",
  cta: "Explore products",
  href: "/shop",
};

function slug(value, fallback = "step") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return normalized || fallback;
}

function triggerKeysFor(step = {}, index = 0) {
  const supplied = Array.isArray(step.triggerKeys) ? step.triggerKeys : step.triggerKey ? [step.triggerKey] : [];
  const keys = supplied.flatMap((value) => String(value || "") === "account_created_or_opt_in"
    ? ["account_created", "email_opt_in"]
    : [String(value || "").trim()]);
  const valid = [...new Set(keys.filter((key) => Object.prototype.hasOwnProperty.call(TRIGGER_DEFINITIONS, key)))];
  if (valid.length) return valid;

  const text = `${step.stage || ""} ${step.trigger || ""}`.toLowerCase();
  const inferred = Object.entries(TRIGGER_DEFINITIONS).find(([, definition]) =>
    definition.aliases.some((alias) => text.includes(alias))
  )?.[0];
  if (inferred) return [inferred];
  if (index === 0) return ["account_created", "email_opt_in"];
  return ["account_created"];
}

function inferScheduleType(step = {}) {
  if (["immediate", "delay", "event"].includes(String(step.scheduleType || ""))) return step.scheduleType;
  const timing = String(step.timing || "").toLowerCase();
  if (/immediate|right away|now/.test(timing)) return "immediate";
  if (/carrier milestone|status changes|when the event|when .* occurs/.test(timing)) return "event";
  return "delay";
}

function inferDelayMinutes(step = {}) {
  const explicit = Number(step.delayMinutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(43_200, Math.round(explicit));
  const timing = String(step.timing || "").toLowerCase();
  const amount = Number(timing.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  if (/day/.test(timing)) return Math.min(43_200, Math.round(amount * 1_440) || 1_440);
  if (/hour/.test(timing)) return Math.min(43_200, Math.round(amount * 60) || 60);
  if (/minute/.test(timing)) return Math.min(43_200, Math.round(amount) || 15);
  return 15;
}

function formatDelay(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  if (value && value % 1_440 === 0) return `${value / 1_440} day${value === 1_440 ? "" : "s"} after the trigger`;
  if (value && value % 60 === 0) return `${value / 60} hour${value === 60 ? "" : "s"} after the trigger`;
  return `${value || 15} minute${value === 1 ? "" : "s"} after the trigger`;
}

function formatTrigger(keys) {
  const labels = keys.map((key) => TRIGGER_DEFINITIONS[key]?.label).filter(Boolean);
  return labels.join(" or ") || TRIGGER_DEFINITIONS.account_created.label;
}

function normalizeJourneyStep(step = {}, index = 0) {
  const source = step && typeof step === "object" ? step : {};
  const triggerKeys = triggerKeysFor(source, index);
  const scheduleType = inferScheduleType(source);
  const delayMinutes = scheduleType === "delay" ? inferDelayMinutes(source) : 0;
  return {
    ...source,
    key: slug(source.key || source.stage, `step-${index + 1}`),
    number: String(index + 1).padStart(2, "0"),
    triggerKey: triggerKeys[0],
    triggerKeys,
    trigger: formatTrigger(triggerKeys),
    scheduleType,
    delayMinutes,
    timing: scheduleType === "immediate" ? SCHEDULE_DEFINITIONS.immediate.label
      : scheduleType === "event" ? SCHEDULE_DEFINITIONS.event.label
        : formatDelay(delayMinutes),
    type: String(source.type || "Marketing") === "Transactional" ? "Transactional" : "Marketing",
  };
}

function normalizeJourney(journey) {
  const source = journey && typeof journey === "object" ? journey : {};
  return {
    ...source,
    steps: (Array.isArray(source.steps) ? source.steps : []).map(normalizeJourneyStep),
  };
}

function journeyPaths() {
  return [
    process.env.MARKETING_JOURNEY_PATH,
    path.resolve(process.cwd(), "data", "customer-email-journey.json"),
    path.resolve(__dirname, "../../fend/data/customer-email-journey.json"),
  ].filter(Boolean).map((value) => path.resolve(value));
}

function readCustomerEmailJourney() {
  for (const filePath of journeyPaths()) {
    try {
      const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (content && Array.isArray(content.steps)) return normalizeJourney(content);
    } catch (_error) {
      // The built-in welcome fallback keeps signup mail functional when the
      // frontend content file is not present in a split deployment.
    }
  }
  return { title: "Customer email journey", status: "Active", steps: [DEFAULT_WELCOME_STEP] };
}

function isMarketingStep(step) {
  return String(step?.type || "Marketing").toLowerCase() !== "transactional";
}

function isWelcomeStep(step) {
  const stage = String(step?.stage || "").toLowerCase();
  const keys = triggerKeysFor(step);
  const trigger = String(step?.trigger || "").toLowerCase();
  return stage.includes("welcome") || String(step?.key || "").toLowerCase() === "welcome"
    || (!step?.key && keys.includes("account_created") && trigger.includes("account created"));
}

function isSignupTriggeredStep(step) {
  const keys = triggerKeysFor(step);
  const scheduleType = inferScheduleType(step);
  return (keys.includes("account_created") || keys.includes("email_opt_in") || keys.includes("signed_up_no_purchase"))
    && scheduleType === "immediate";
}

function getWelcomeStep(journey = readCustomerEmailJourney()) {
  const steps = normalizeJourney(journey).steps;
  return steps.find((step) => isMarketingStep(step) && isWelcomeStep(step))
    || steps.find((step) => isMarketingStep(step))
    || DEFAULT_WELCOME_STEP;
}

function getSignupMarketingSteps(journey = readCustomerEmailJourney()) {
  const normalized = normalizeJourney(journey);
  const welcomeStep = getWelcomeStep(normalized);
  return normalized.steps.filter((step) => isMarketingStep(step) && step.key !== welcomeStep.key && isSignupTriggeredStep(step));
}

module.exports = {
  DEFAULT_WELCOME_STEP,
  SCHEDULE_DEFINITIONS,
  TRIGGER_DEFINITIONS,
  formatDelay,
  formatTrigger,
  getSignupMarketingSteps,
  getWelcomeStep,
  inferDelayMinutes,
  inferScheduleType,
  isMarketingStep,
  isWelcomeStep,
  normalizeJourney,
  normalizeJourneyStep,
  readCustomerEmailJourney,
  slug,
  triggerKeysFor,
};
