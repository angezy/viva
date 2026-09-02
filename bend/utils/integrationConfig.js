const fs = require("fs");
const path = require("path");

// Explicit allowlist: the dashboard can edit integration variables only.
const INTEGRATION_GROUPS = [
  {
    id: "database", title: "Database", target: "backend", restartRequired: true,
    description: "MSSQL connection and pool settings used by the backend.",
    requiredKeys: ["DB_SERVER", "DB_DATABASE", "DB_USER", "DB_PASSWORD"],
    fields: [
      ["DB_SERVER", "Server", "text"], ["DB_PORT", "Port", "number"], ["DB_DATABASE", "Database", "text"],
      ["DB_USER", "Username", "text"], ["DB_PASSWORD", "Password", "secret"], ["DB_ENCRYPT", "Encrypt connection", "boolean"],
      ["DB_TRUST_SERVER_CERT", "Trust server certificate", "boolean"], ["DB_POOL_MAX", "Pool maximum", "number"],
      ["DB_POOL_MIN", "Pool minimum", "number"], ["DB_POOL_IDLE_TIMEOUT_MS", "Idle timeout (ms)", "number"],
    ],
  },
  {
    id: "sendpulse", title: "SendPulse email", target: "backend",
    description: "Customer welcome and consent-based lifecycle email, plus support, password resets, and owner notifications.",
    requiredKeys: ["SENDPULSE_CLIENT_ID", "SENDPULSE_CLIENT_SECRET", "SENDPULSE_FROM_EMAIL"],
    fields: [
      ["SENDPULSE_ENABLED", "Enabled", "boolean"], ["SENDPULSE_API_BASE_URL", "API base URL", "url"],
      ["SENDPULSE_CLIENT_ID", "Client ID", "secret"], ["SENDPULSE_CLIENT_SECRET", "Client secret", "secret"],
      ["SENDPULSE_FROM_EMAIL", "From email", "email"], ["SENDPULSE_FROM_NAME", "From name", "text"], ["MARKETING_JOURNEY_PATH", "Marketing journey file", "text"], ["MARKETING_EMAIL_AUTOMATION_ENABLED", "Journey automation enabled", "boolean"], ["MARKETING_EMAIL_POLL_INTERVAL_MS", "Journey poll interval (ms)", "number"],
      ["SENDPULSE_ADMIN_FROM_EMAIL", "Admin notification from email", "email"], ["SENDPULSE_ADMIN_FROM_NAME", "Admin notification from name", "text"],
      ["SUPPORT_ADMIN_EMAIL", "Support recipient email", "email"], ["SUPPORT_ADMIN_NAME", "Support recipient name", "text"],
      ["OWNER_EMAIL", "Owner notification email", "email"], ["APP_BASE_URL", "Public app URL", "url"],
    ],
  },
  {
    id: "cj", title: "CJ Dropshipping", target: "backend",
    description: "Product sync, live shipping, tracking, and fulfillment controls.",
    requiredAnyKeys: [["CJ_API_KEY", "CJ_ACCESS_TOKEN", "CJ_API_TOKEN", "CJ_TOKEN"]],
    fields: [
      ["CJ_API_KEY", "API key", "secret"], ["CJ_ACCESS_TOKEN", "Access token", "secret"], ["CJ_API_TOKEN", "Legacy API token", "secret"],
      ["CJ_TOKEN", "Older legacy token", "secret"], ["CJ_API_BASE_URL", "API base URL", "url"], ["CJ_API_BASE", "Older API base URL", "url"],
      ["CJ_API_TOKEN_URL", "Token URL", "url"], ["CJ_API_LIST_URL", "Product list URL", "url"], ["CJ_API_REVIEWS_URL", "Reviews URL", "url"],
      ["CJ_STORE_SYNC_ENABLED", "Sync imported products to CJ", "boolean"], ["CJ_SHOP_ID", "CJ shop ID", "text"],
      ["CJ_PRODUCT_CONNECTION_LOGISTICS", "Product connection logistics", "text"], ["CJ_CONNECTION_DEFAULT_AREA", "CJ warehouse area", "number"],
      ["CJ_CONNECTION_IGNORE_INVENTORY", "Ignore connection inventory check", "boolean"], ["CJ_SOURCE_COUNTRY_CODE", "Connection source country", "text"],
      ["CJ_SOURCE_COUNTRY", "Connection source country name", "text"], ["CJ_TARGET_COUNTRY_CODE", "Connection target country", "text"],
      ["CJ_TARGET_COUNTRY", "Connection target country name", "text"],
      ["CJ_FULFILLMENT_ENABLED", "Fulfillment enabled", "boolean"], ["CJ_SANDBOX_MODE", "Sandbox mode", "boolean"], ["CJ_AUTO_PAY_ENABLED", "Auto-pay CJ balance", "boolean"],
      ["CJ_FROM_COUNTRY_CODE", "Ship-from country", "text"], ["CJ_LOGISTIC_NAME", "Legacy logistics name", "text"], ["CJ_SHOP_LOGISTICS_TYPE", "Logistics type", "number"],
      ["CJ_TRACKING_SYNC_TTL_SECONDS", "Tracking cache (seconds)", "number"], ["CJ_REQUEST_TIMEOUT_MS", "Request timeout (ms)", "number"],
      ["CJ_REQUEST_MIN_INTERVAL_MS", "Request interval (ms)", "number"], ["CJ_FALLBACK_IMAGE", "Fallback image URL", "url"], ["CJ_STORE_PRODUCT_IMAGE_DEFAULT", "Legacy product image URL", "url"],
    ],
  },
  {
    id: "hypersku", title: "HyperSKU", target: "backend",
    description: "HyperSKU API access for product sourcing, logistics quotes, order submission, and tracking.",
    requiredAnyKeys: [["HYPERSKU_API_KEY", "HYPERSKU_ACCESS_TOKEN"]],
    fields: [
      ["HYPERSKU_ENABLED", "Enabled", "boolean"], ["HYPERSKU_API_BASE_URL", "API base URL", "url"],
      ["HYPERSKU_API_KEY", "API key", "secret"], ["HYPERSKU_ACCESS_TOKEN", "Access token", "secret"],
      ["HYPERSKU_USERNAME", "API username", "secret"], ["HYPERSKU_PASSWORD", "API password", "secret"],
      ["HYPERSKU_TOKEN_URL", "Token URL", "url"],
      ["HYPERSKU_AUTH_HEADER_PREFIX", "Authorization prefix", "text"], ["HYPERSKU_STORE_CODE", "Store code", "text"],
      ["HYPERSKU_REQUEST_TIMEOUT_MS", "Request timeout (ms)", "number"], ["HYPERSKU_REQUEST_MIN_INTERVAL_MS", "Request interval (ms)", "number"],
    ],
  },
  {
    id: "google", title: "Google sign-in", target: "backend",
    description: "OAuth credentials for customer Google sign-in.", requiredKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    fields: [["GOOGLE_CLIENT_ID", "Client ID", "text"], ["GOOGLE_CLIENT_SECRET", "Client secret", "secret"], ["GOOGLE_REDIRECT_URI", "Redirect URI", "url"], ["FRONTEND_URL", "Frontend origin", "url"], ["CORS_ORIGINS", "Allowed CORS origins", "text"]],
  },
  {
    id: "telegram", title: "Telegram support", target: "backend",
    description: "Customer support handoff and agent replies through the Telegram bot bridge.", requiredKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET"],
    fields: [["TELEGRAM_BOT_TOKEN", "Bot token", "secret"], ["TELEGRAM_ADMIN_CHAT_ID", "Admin chat ID", "text"], ["TELEGRAM_WEBHOOK_SECRET", "Webhook secret", "secret"], ["TELEGRAM_WEBHOOK_URL", "Webhook URL", "url", true]],
  },
  {
    id: "stripe", title: "Stripe payments", target: "backend", description: "Stripe-hosted Checkout and webhook verification.", requiredKeys: ["PAYMENT_PROVIDER", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    fields: [["PAYMENT_PROVIDER", "Payment provider", "text"], ["STRIPE_SECRET_KEY", "Secret key", "secret"], ["STRIPE_WEBHOOK_SECRET", "Webhook signing secret", "secret"], ["CHECKOUT_CURRENCY", "Checkout currency", "text"]],
  },
  {
    id: "chatbot", title: "AI chatbot", target: "mixed", description: "Groq-backed customer chat settings. Frontend values require a frontend restart.", requiredKeys: ["GROQ_API_KEY"],
    fields: [
      ["WELUXO_CHAT_ENABLED", "Chat enabled", "boolean", false, "frontend"], ["BACKEND_URL", "Backend URL", "url", false, "frontend"], ["GROQ_API_KEY", "Groq API key", "secret", false, "frontend"], ["GROQ_MODEL", "Groq model", "text", false, "frontend"],
      ["WELUXO_CHAT_TITLE", "Chat title", "text", false, "frontend"], ["WELUXO_CHAT_SUBTITLE", "Chat subtitle", "text", false, "frontend"], ["WELUXO_CHAT_GREETING", "Greeting", "text", false, "frontend"],
      ["WELUXO_CHAT_PLACEHOLDER", "Input placeholder", "text", false, "frontend"], ["WELUXO_CHAT_TRIGGER_LABEL", "Open chat label", "text", false, "frontend"], ["WELUXO_CHAT_THINKING", "Thinking label", "text", false, "frontend"],
      ["WELUXO_CHAT_FALLBACK", "Fallback message", "text", false, "frontend"], ["WELUXO_CHAT_ERROR", "Error message", "text", false, "frontend"],
      ["CHAT_INTERNAL_SECRET", "Internal chat secret", "secret", true, "shared"], ["CHAT_SESSION_SECRET", "Chat session secret", "secret", true, "backend"],
    ],
  },
  { id: "support", title: "Support notifications", target: "backend", optional: true, description: "Optional webhook delivery for internal support ticket notifications.", fields: [["SUPPORT_NOTIFICATION_WEBHOOK_URL", "Notification webhook URL", "url"]] },
  { id: "tinymce", title: "TinyMCE editor", target: "frontend", optional: true, description: "Browser-safe API key for the blog and support rich-text editors. Restart the frontend after saving.", fields: [["NEXT_PUBLIC_TINYMCE_API_KEY", "TinyMCE API key", "secret"]] },
].map((group) => ({
  ...group,
  fields: group.fields.map(([key, label, type, restartRequired = false, target = group.target]) => ({ key, label, type, restartRequired, target })),
}));

const FIELD_BY_KEY = new Map(INTEGRATION_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, { ...field, groupId: group.id, restartRequired: field.restartRequired || group.restartRequired }] )));

function backendEnvPaths() {
  return [...new Set([path.resolve(process.cwd(), ".env"), path.resolve(__dirname, "..", ".env")])];
}

function frontendEnvPaths() {
  const root = path.resolve(__dirname, "..", "..", "fend");
  return [path.join(root, ".env.local"), path.join(root, ".env")];
}

function readEnvFile(filePath) {
  try {
    const values = {};
    fs.readFileSync(filePath, "utf8").split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) return;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      values[match[1]] = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"');
    });
    return values;
  } catch (_error) { return {}; }
}

function valueFromFiles(paths, key) {
  for (const filePath of paths) {
    const values = readEnvFile(filePath);
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
  }
  return "";
}

function valuesForShared(key) {
  return {
    backend: String(process.env[key] || "") || valueFromFiles(backendEnvPaths(), key),
    frontend: valueFromFiles(frontendEnvPaths(), key) || String(process.env[key] || ""),
  };
}

function rawValue(field) {
  if (field.target === "frontend") return valueFromFiles(frontendEnvPaths(), field.key) || String(process.env[field.key] || "");
  if (field.target === "shared") {
    const values = valuesForShared(field.key);
    return values.backend || values.frontend;
  }
  return String(process.env[field.key] || "");
}

function maskValue(value) {
  const text = String(value || "");
  return text ? `${"•".repeat(Math.min(12, Math.max(6, text.length - 4)))}${text.slice(-4)}` : "";
}

function placeholder(value) {
  return /^(?:replace-with|your-(?:sql|database|telegram|google|stripe)|owner@example\.com|example(?:@|\.com))/i.test(String(value || "").trim());
}

function fieldStatus(field) {
  const value = rawValue(field);
  return { ...field, configured: Boolean(value.trim()) && !placeholder(value), placeholderValue: Boolean(value.trim()) && placeholder(value), value: field.type === "secret" ? maskValue(value) : value };
}

function readIntegrationConfig() {
  return {
    groups: INTEGRATION_GROUPS.map((group) => {
      const fields = group.fields.map(fieldStatus);
      const configured = group.requiredKeys?.length
        ? group.requiredKeys.every((key) => fields.find((field) => field.key === key)?.configured)
        : group.requiredAnyKeys?.length
          ? group.requiredAnyKeys.every((keys) => keys.some((key) => fields.find((field) => field.key === key)?.configured))
          : fields.some((field) => field.configured);
      return { id: group.id, title: group.title, description: group.description, target: group.target, optional: Boolean(group.optional), configured, configuredCount: fields.filter((field) => field.configured).length, fieldCount: fields.length, fields };
    }),
    note: "Secret values are never returned. Leave a secret field blank to keep it unchanged; clear it explicitly when needed.",
  };
}

function writeEnvValue(filePath, key, value) {
  let contents = "";
  try { contents = fs.readFileSync(filePath, "utf8"); } catch (_error) { /* create it below */ }
  const lines = contents ? contents.split(/\r?\n/) : [];
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*${escapedKey}\\s*=.*$`);
  const serialized = value ? (/^[A-Za-z0-9_./:@%+,=?&-]+$/.test(value) ? value : JSON.stringify(value)) : "";
  let replaced = false;
  const next = lines.map((line) => {
    if (!pattern.test(line)) return line;
    replaced = true;
    return `${key}=${serialized}`;
  });
  if (!replaced) {
    while (next.length && !next[next.length - 1]) next.pop();
    if (next.length) next.push("");
    next.push(`${key}=${serialized}`);
  }
  fs.writeFileSync(filePath, `${next.join("\n").replace(/\n+$/, "")}\n`, { encoding: "utf8", mode: 0o600 });
}

function writeTargetValue(target, key, value) {
  const paths = target === "frontend" ? frontendEnvPaths() : backendEnvPaths();
  const existing = paths.find((filePath) => {
    try { return new RegExp(`^\\s*${key}\\s*=`, "m").test(fs.readFileSync(filePath, "utf8")); } catch (_error) { return false; }
  });
  const filePath = existing || paths.find((candidate) => fs.existsSync(candidate)) || paths[paths.length - 1];
  writeEnvValue(filePath, key, value);
}

function validate(field, input) {
  const value = String(input ?? "").replace(/[\r\n]+/g, " ").trim();
  if (value.length > 2000) return "must be 2,000 characters or fewer";
  if (!value) return null;
  if (field.type === "boolean" && !/^(?:true|false)$/i.test(value)) return "must be true or false";
  if (field.type === "number" && (!/^\d+$/.test(value) || Number(value) > 2147483647)) return "must be a positive whole number";
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "must be a valid email address";
  if (field.type === "url" && !/^https?:\/\/[^\s]+$/i.test(value)) return "must be an http(s) URL";
  if (field.key === "PAYMENT_PROVIDER" && value.toLowerCase() !== "stripe") return "must be stripe";
  if (field.key === "CJ_FROM_COUNTRY_CODE" && !/^[A-Za-z]{2}$/.test(value)) return "must be a two-letter country code";
  if (field.key === "CHECKOUT_CURRENCY" && !/^[A-Za-z]{3}$/.test(value)) return "must be a three-letter currency code";
  return null;
}

function saveIntegrationValues(updates) {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) throw Object.assign(new Error("Provide integration updates as an object"), { statusCode: 400 });
  const entries = Object.entries(updates);
  if (!entries.length) throw Object.assign(new Error("Choose at least one integration value to save"), { statusCode: 400 });
  const prepared = entries.map(([key, rawInput]) => {
    const field = FIELD_BY_KEY.get(key);
    if (!field) throw Object.assign(new Error(`Integration variable ${key} is not editable`), { statusCode: 400 });
    const clear = rawInput && typeof rawInput === "object" && rawInput.clear === true;
    if (rawInput && typeof rawInput === "object" && !clear) throw Object.assign(new Error(`${key} must be a string or an explicit clear instruction`), { statusCode: 400 });
    const value = clear ? "" : String(rawInput ?? "");
    const issue = validate(field, value);
    if (issue) throw Object.assign(new Error(`${key} ${issue}`), { statusCode: 400 });
    return { key, field, value };
  });
  const restartRequiredKeys = [];
  prepared.forEach(({ key, field, value }) => {
    if (field.target === "shared") { writeTargetValue("backend", key, value); writeTargetValue("frontend", key, value); process.env[key] = value; }
    else { writeTargetValue(field.target, key, value); if (field.target === "backend") process.env[key] = value; }
    if (field.restartRequired || field.target === "frontend") restartRequiredKeys.push(key);
  });
  return { changedKeys: prepared.map((entry) => entry.key), restartRequired: restartRequiredKeys.length > 0, restartRequiredKeys, config: readIntegrationConfig() };
}

module.exports = { INTEGRATION_GROUPS, readIntegrationConfig, saveIntegrationValues };
