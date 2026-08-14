const DEFAULT_API_BASE_URL = "https://api.sendpulse.com";

let tokenCache = {
  accessToken: "",
  expiresAt: 0,
};

function getConfig() {
  return {
    enabled: String(process.env.SENDPULSE_ENABLED || "true").toLowerCase() !== "false",
    apiBaseUrl: String(process.env.SENDPULSE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, ""),
    clientId: String(process.env.SENDPULSE_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.SENDPULSE_CLIENT_SECRET || "").trim(),
    fromEmail: String(process.env.SENDPULSE_FROM_EMAIL || "").trim(),
    fromName: String(process.env.SENDPULSE_FROM_NAME || "Weluxo Support").trim(),
    adminEmail: String(process.env.SUPPORT_ADMIN_EMAIL || "").trim(),
    adminName: String(process.env.SUPPORT_ADMIN_NAME || "Weluxo Support").trim(),
    appBaseUrl: String(process.env.APP_BASE_URL || "").replace(/\/+$/, ""),
  };
}

function isSendPulseConfigured() {
  const config = getConfig();
  return Boolean(config.enabled && config.clientId && config.clientSecret && config.fromEmail && config.adminEmail);
}

function isSendPulseMailerConfigured() {
  const config = getConfig();
  return Boolean(config.enabled && config.clientId && config.clientSecret && config.fromEmail);
}

async function readJson(response) {
  const body = await response.text();
  try {
    return body ? JSON.parse(body) : {};
  } catch (_error) {
    return { raw: body.slice(0, 500) };
  }
}

async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(config) {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) return tokenCache.accessToken;

  const response = await fetchWithTimeout(`${config.apiBaseUrl}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  const data = await readJson(response);
  if (!response.ok || !data.access_token) {
    throw new Error(`SendPulse authentication failed (${response.status})`);
  }

  const expiresInSeconds = Number(data.expires_in) || 3600;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, expiresInSeconds - 60) * 1000,
  };
  return tokenCache.accessToken;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function encodeBase64(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function getTicketMessage(ticket) {
  const message = Array.isArray(ticket?.messages) ? ticket.messages[0] : null;
  return {
    html: message?.contentHtml || escapeHtml(message?.contentText || ""),
    text: message?.contentText || "",
  };
}

function buildTicketEmail(ticket, config) {
  const message = getTicketMessage(ticket);
  const dashboardUrl = config.appBaseUrl ? `${config.appBaseUrl}/dashboard/tikects/${ticket.id}` : "";
  const safeDashboardUrl = escapeHtml(dashboardUrl);
  const safeTicketNumber = escapeHtml(ticket.ticketNumber);
  const safeSubject = escapeHtml(ticket.subject);
  const safeName = escapeHtml(ticket.customerName);
  const safeEmail = escapeHtml(ticket.customerEmail);
  const safeCategory = escapeHtml(ticket.category);
  const safePriority = escapeHtml(ticket.priority);
  const safeOrder = escapeHtml(ticket.orderId || "Not provided");
  const safeText = String(message.text || "").trim();
  const action = dashboardUrl
    ? `<p><a href="${safeDashboardUrl}" style="display:inline-block;padding:12px 18px;background:#12372a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">Open ticket in dashboard</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f5;color:#132019;font-family:Arial,sans-serif"><div style="max-width:620px;margin:32px auto;padding:28px;background:#ffffff;border:1px solid #dbe7dc;border-radius:16px"><p style="color:#3e785e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">NEW SUPPORT TICKET</p><h1 style="margin:8px 0 22px;font-size:26px">${safeTicketNumber}: ${safeSubject}</h1><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:7px 0;color:#718278">Customer</td><td style="padding:7px 0;font-weight:700">${safeName} &lt;${safeEmail}&gt;</td></tr><tr><td style="padding:7px 0;color:#718278">Category</td><td style="padding:7px 0;font-weight:700">${safeCategory}</td></tr><tr><td style="padding:7px 0;color:#718278">Priority</td><td style="padding:7px 0;font-weight:700">${safePriority}</td></tr><tr><td style="padding:7px 0;color:#718278">Order</td><td style="padding:7px 0;font-weight:700">${safeOrder}</td></tr></table><hr style="border:0;border-top:1px solid #e6eee7;margin:22px 0"><h2 style="font-size:16px">Customer message</h2><div style="line-height:1.65">${message.html}</div>${action}</div></body></html>`;
  const text = `New support ticket ${ticket.ticketNumber}\n\nSubject: ${ticket.subject}\nCustomer: ${ticket.customerName} <${ticket.customerEmail}>\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\nOrder: ${ticket.orderId || "Not provided"}\n\nCustomer message:\n${safeText}${dashboardUrl ? `\n\nOpen ticket: ${dashboardUrl}` : ""}`;
  return {
    subject: `[Weluxo Support] ${ticket.ticketNumber} · ${ticket.subject}`,
    html,
    text,
  };
}

async function sendSupportTicketEmail(ticket) {
  const config = getConfig();
  if (!config.enabled) return { sent: false, skipped: true, reason: "disabled" };
  if (!isSendPulseConfigured()) return { sent: false, skipped: true, reason: "not_configured" };

  const token = await getAccessToken(config);
  const email = buildTicketEmail(ticket, config);
  const response = await fetchWithTimeout(`${config.apiBaseUrl}/smtp/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: {
        html: encodeBase64(email.html),
        text: encodeBase64(email.text),
        subject: email.subject,
        from: { name: config.fromName, email: config.fromEmail },
        to: [{ name: config.adminName, email: config.adminEmail }],
      },
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`SendPulse email failed (${response.status})`);
  return { sent: true, response: data };
}

async function sendPasswordResetCodeEmail({ email, code, expiresInMinutes }) {
  const config = getConfig();
  if (!config.enabled) return { sent: false, skipped: true, reason: "disabled" };
  if (!isSendPulseMailerConfigured()) return { sent: false, skipped: true, reason: "not_configured" };

  const safeCode = escapeHtml(code);
  const minutes = Math.max(1, Number(expiresInMinutes) || 10);
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f5;color:#132019;font-family:Arial,sans-serif"><div style="max-width:560px;margin:32px auto;padding:28px;background:#ffffff;border:1px solid #dbe7dc;border-radius:16px"><p style="color:#3e785e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">WELUXO ACCOUNT SECURITY</p><h1 style="margin:8px 0 16px;font-size:26px">Reset your password</h1><p style="line-height:1.6">Use this verification code to choose a new password for your Weluxo customer account:</p><p style="margin:24px 0;text-align:center;font-size:34px;letter-spacing:10px;font-weight:800;color:#12372a">${safeCode}</p><p style="line-height:1.6;color:#52645a">This code expires in ${minutes} minutes. If you did not request a password reset, you can safely ignore this email.</p></div></body></html>`;
  const text = `Reset your Weluxo password\n\nYour verification code is: ${code}\n\nThis code expires in ${minutes} minutes. If you did not request a password reset, you can safely ignore this email.`;

  const token = await getAccessToken(config);
  const response = await fetchWithTimeout(`${config.apiBaseUrl}/smtp/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: {
        html: encodeBase64(html),
        text: encodeBase64(text),
        subject: "Your Weluxo password reset code",
        from: { name: config.fromName, email: config.fromEmail },
        to: [{ name: "Weluxo customer", email }],
      },
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`SendPulse password reset email failed (${response.status})`);
  return { sent: true, response: data };
}

module.exports = { isSendPulseConfigured, isSendPulseMailerConfigured, sendSupportTicketEmail, sendPasswordResetCodeEmail };
