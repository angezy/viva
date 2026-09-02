const DEFAULT_API_BASE_URL = "https://api.sendpulse.com";
const {
  getSignupMarketingSteps,
  getWelcomeStep,
  readCustomerEmailJourney,
} = require("./customerEmailJourney");

let tokenCache = {
  accessToken: "",
  expiresAt: 0,
};

function getConfig() {
  const brandName = String(process.env.STORE_NAME || "Your Store").trim().slice(0, 100) || "Your Store";
  return {
    enabled: String(process.env.SENDPULSE_ENABLED || "true").toLowerCase() !== "false",
    apiBaseUrl: String(process.env.SENDPULSE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, ""),
    clientId: String(process.env.SENDPULSE_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.SENDPULSE_CLIENT_SECRET || "").trim(),
    fromEmail: String(process.env.SENDPULSE_FROM_EMAIL || "").trim(),
    fromName: String(process.env.SENDPULSE_FROM_NAME || `${brandName} Support`).trim(),
    adminFromEmail: String(process.env.SENDPULSE_ADMIN_FROM_EMAIL || "").trim(),
    adminFromName: String(process.env.SENDPULSE_ADMIN_FROM_NAME || `${brandName} Notifications`).trim(),
    adminEmail: String(process.env.SUPPORT_ADMIN_EMAIL || "").trim(),
    adminName: String(process.env.SUPPORT_ADMIN_NAME || `${brandName} Support`).trim(),
    ownerEmail: String(process.env.OWNER_EMAIL || "").trim(),
    appBaseUrl: String(process.env.APP_BASE_URL || process.env.STORE_URL || "").replace(/\/+$/, ""),
    brandName,
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

function safeEmailSubject(value, fallback) {
  return String(value || fallback || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function safeEmailBodyHtml(value) {
  const body = String(value || "").trim();
  if (!body) return "";
  // Journey content is editable by an administrator. Preserve approved rich
  // text when present, while escaping plain-text copy before embedding it.
  if (/<[a-z][\s\S]*>/i.test(body)) {
    try {
      const sanitizeHtml = require("sanitize-html");
      return sanitizeHtml(body, {
        allowedTags: ["a", "b", "br", "em", "h1", "h2", "h3", "i", "li", "ol", "p", "strong", "ul"],
        allowedAttributes: { a: ["href", "rel", "target"] },
        allowedSchemes: ["http", "https"],
      });
    } catch (_error) {
      // Fall through to escaped plain text if the optional sanitizer is not
      // available in a minimal backend installation.
    }
  }
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="line-height:1.65;margin:0 0 16px">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function emailBodyText(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function resolveCustomerLink(config, href) {
  const value = String(href || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (config.appBaseUrl && value.startsWith("/")) return `${config.appBaseUrl}${value}`;
  return "";
}

function buildCustomerJourneyEmail({ step, config, recipientName, marketing }) {
  const safeName = escapeHtml(recipientName || `${config.brandName} customer`);
  const subject = safeEmailSubject(step?.subject, `${config.brandName} update`);
  const bodyHtml = safeEmailBodyHtml(step?.body);
  const bodyText = emailBodyText(step?.body);
  const actionUrl = resolveCustomerLink(config, step?.href);
  const actionLabel = String(step?.cta || "Explore the store").trim().slice(0, 80);
  const actionHtml = actionUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;background:#12372a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">${escapeHtml(actionLabel)}</a></p>`
    : "";
  const unsubscribeUrl = marketing ? resolveCustomerLink(config, "/account/settings") : "";
  const footerHtml = marketing
    ? `<p style="margin-top:28px;padding-top:18px;border-top:1px solid #e6eee7;color:#718278;font-size:12px;line-height:1.6">You are receiving this because you opted in to ${escapeHtml(config.brandName)} marketing emails. <a href="${escapeHtml(unsubscribeUrl || "/account/settings")}" style="color:#2d6a4f">Manage email preferences</a>.</p>`
    : "";
  const footerText = marketing
    ? `\n\nManage email preferences: ${unsubscribeUrl || "/account/settings"}`
    : "";
  const safeBrandName = escapeHtml(config.brandName);
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f5;color:#132019;font-family:Arial,sans-serif"><div style="max-width:620px;margin:32px auto;padding:28px;background:#ffffff;border:1px solid #dbe7dc;border-radius:16px"><p style="color:#3e785e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${safeBrandName}</p><p style="font-size:16px;font-weight:700">Hi ${safeName},</p>${bodyHtml}${actionHtml}${footerHtml}</div></body></html>`;
  const greetinglessText = bodyText.replace(/^Hi there,?\s*/i, "").trim();
  const text = `Hi ${recipientName || `${config.brandName} customer`},\n\n${greetinglessText || bodyText}${actionUrl ? `\n\n${actionLabel}: ${actionUrl}` : ""}${footerText}`;
  return { subject, html, text };
}

async function sendCustomerJourneyEmail({ email, name, step, marketing = false, marketingConsent = true } = {}) {
  const config = getConfig();
  if (!config.enabled) return { sent: false, skipped: true, reason: "disabled" };
  if (!isSendPulseMailerConfigured()) return { sent: false, skipped: true, reason: "not_configured" };
  if (marketing && marketingConsent !== true) return { sent: false, skipped: true, reason: "marketing_consent_required" };

  const recipientEmail = String(email || "").trim().toLowerCase();
  if (!recipientEmail) return { sent: false, skipped: true, reason: "recipient_missing" };
  if (!/^\S+@\S+\.\S+$/.test(recipientEmail)) return { sent: false, skipped: true, reason: "recipient_invalid" };
  if (config.fromEmail.toLowerCase() === recipientEmail) {
    throw new Error("SENDPULSE_FROM_EMAIL must be different from the customer recipient");
  }

  const message = buildCustomerJourneyEmail({ step, config, recipientName: name, marketing });
  const token = await getAccessToken(config);
  const response = await fetchWithTimeout(`${config.apiBaseUrl}/smtp/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: {
        html: encodeBase64(message.html),
        text: encodeBase64(message.text),
        subject: message.subject,
        from: { name: config.fromName, email: config.fromEmail },
        to: [{ name: name || `${config.brandName} customer`, email: recipientEmail }],
      },
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`SendPulse customer email failed (${response.status})`);
  return { sent: true, response: data, subject: message.subject };
}

async function sendWelcomeEmail({ email, name } = {}) {
  return sendCustomerJourneyEmail({ email, name, step: getWelcomeStep(readCustomerEmailJourney()) });
}

async function sendSignupMarketingEmails({ email, name, marketingConsent } = {}) {
  if (marketingConsent !== true) return { sent: 0, skipped: true, reason: "marketing_consent_required" };
  const journey = readCustomerEmailJourney();
  const results = [];
  for (const step of getSignupMarketingSteps(journey)) {
    results.push(await sendCustomerJourneyEmail({ email, name, step, marketing: true, marketingConsent }));
  }
  return { sent: results.filter((result) => result.sent).length, results };
}

function getTicketMessage(ticket) {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  const message = messages[messages.length - 1] || null;
  return {
    html: message?.contentHtml || escapeHtml(message?.contentText || ""),
    text: message?.contentText || "",
    attachments: Array.isArray(message?.attachments) ? message.attachments : [],
  };
}

function resolveAttachmentUrl(config, value) {
  const rawUrl = String(value || "").trim();
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (config.appBaseUrl && rawUrl.startsWith("/")) return `${config.appBaseUrl}${rawUrl}`;
  return "";
}

function buildTicketEmail(ticket, config, options = {}) {
  const recipient = options.recipient === "customer" ? "customer" : "admin";
  const eventType = options.eventType === "reply" ? "reply" : "created";
  const message = getTicketMessage(ticket);
  const ticketUrl = config.appBaseUrl
    ? `${config.appBaseUrl}/${recipient === "admin" ? "dashboard/tikects" : "support/tickets"}/${ticket.id}`
    : "";
  const safeTicketUrl = escapeHtml(ticketUrl);
  const safeTicketNumber = escapeHtml(ticket.ticketNumber);
  const safeSubject = escapeHtml(ticket.subject);
  const safeName = escapeHtml(ticket.customerName);
  const safeEmail = escapeHtml(ticket.customerEmail);
  const safeCategory = escapeHtml(ticket.category);
  const safePriority = escapeHtml(ticket.priority);
  const safeOrder = escapeHtml(ticket.orderId || "Not provided");
  const safeBrandName = escapeHtml(config.brandName);
  const safeText = String(message.text || "").trim();
  const attachments = message.attachments
    .map((attachment) => ({
      name: String(attachment?.name || "Attachment"),
      url: resolveAttachmentUrl(config, attachment?.url),
    }))
    .filter((attachment) => attachment.url);
  const attachmentsHtml = attachments.length
    ? `<div style="margin-top:20px;padding:14px 16px;background:#f5f7f5;border:1px solid #e6eee7;border-radius:10px"><h2 style="font-size:16px;margin:0 0 8px">Attachments</h2><ul style="margin:0;padding-left:20px">${attachments.map((attachment) => `<li style="margin:5px 0"><a href="${escapeHtml(attachment.url)}" style="color:#2d6a4f">${escapeHtml(attachment.name)}</a></li>`).join("")}</ul></div>`
    : "";
  const attachmentsText = attachments.length
    ? `\n\nAttachments:\n${attachments.map((attachment) => `${attachment.name} - ${attachment.url}`).join("\n")}`
    : "";
  const heading = eventType === "created"
    ? (recipient === "admin" ? "New support ticket" : "We received your support ticket")
    : (recipient === "admin" ? "Customer replied to a support ticket" : "Support replied to your ticket");
  const messageHeading = eventType === "created"
    ? (recipient === "admin" ? "Customer message" : "Your message")
    : (recipient === "admin" ? "Customer reply" : "Support reply");
  const actionLabel = recipient === "admin" ? "Open ticket in dashboard" : "View ticket conversation";
  const action = ticketUrl
    ? `<p><a href="${safeTicketUrl}" style="display:inline-block;padding:12px 18px;background:#12372a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">${actionLabel}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f5;color:#132019;font-family:Arial,sans-serif"><div style="max-width:620px;margin:32px auto;padding:28px;background:#ffffff;border:1px solid #dbe7dc;border-radius:16px"><p style="color:#3e785e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${safeBrandName} SUPPORT</p><h1 style="margin:8px 0 22px;font-size:26px">${heading}</h1><p style="font-size:16px;font-weight:700;margin-bottom:8px">${safeTicketNumber}: ${safeSubject}</p><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:7px 0;color:#718278">Customer</td><td style="padding:7px 0;font-weight:700">${safeName} &lt;${safeEmail}&gt;</td></tr><tr><td style="padding:7px 0;color:#718278">Category</td><td style="padding:7px 0;font-weight:700">${safeCategory}</td></tr><tr><td style="padding:7px 0;color:#718278">Priority</td><td style="padding:7px 0;font-weight:700">${safePriority}</td></tr><tr><td style="padding:7px 0;color:#718278">Order</td><td style="padding:7px 0;font-weight:700">${safeOrder}</td></tr></table><hr style="border:0;border-top:1px solid #e6eee7;margin:22px 0"><h2 style="font-size:16px">${messageHeading}</h2><div style="line-height:1.65">${message.html}</div>${attachmentsHtml}${action}</div></body></html>`;
  const text = `${heading}\n\nTicket: ${ticket.ticketNumber}\nSubject: ${ticket.subject}\nCustomer: ${ticket.customerName} <${ticket.customerEmail}>\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\nOrder: ${ticket.orderId || "Not provided"}\n\n${messageHeading}:\n${safeText}${attachmentsText}${ticketUrl ? `\n\nView ticket: ${ticketUrl}` : ""}`;
  return {
    subject: `[${config.brandName} Support] ${ticket.ticketNumber} - ${ticket.subject}`,
    html,
    text,
  };
}

async function sendSupportTicketEmail(ticket, options = {}) {
  const config = getConfig();
  if (!config.enabled) return { sent: false, skipped: true, reason: "disabled" };
  if (!isSendPulseMailerConfigured()) return { sent: false, skipped: true, reason: "not_configured" };

  const recipient = options.recipient === "customer" ? "customer" : "admin";
  const recipientEmail = String(options.recipientEmail || (recipient === "customer" ? ticket?.customerEmail : config.adminEmail) || "").trim();
  if (!recipientEmail) return { sent: false, skipped: true, reason: "recipient_missing" };
  const fromEmail = recipient === "admin" ? (config.adminFromEmail || config.fromEmail) : config.fromEmail;
  if (!fromEmail) throw new Error("Configure a verified SendPulse sender email");
  if (fromEmail.toLowerCase() === recipientEmail.toLowerCase()) throw new Error("SENDPULSE_ADMIN_FROM_EMAIL must be different from the admin recipient");

  const token = await getAccessToken(config);
  const email = buildTicketEmail(ticket, config, options);
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
        from: { name: recipient === "admin" ? config.adminFromName : config.fromName, email: fromEmail },
        to: [{ name: recipient === "customer" ? (ticket.customerName || `${config.brandName} customer`) : (options.recipientName || config.adminName), email: recipientEmail }],
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
  const safeBrandName = escapeHtml(config.brandName);
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f5;color:#132019;font-family:Arial,sans-serif"><div style="max-width:560px;margin:32px auto;padding:28px;background:#ffffff;border:1px solid #dbe7dc;border-radius:16px"><p style="color:#3e785e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${safeBrandName} ACCOUNT SECURITY</p><h1 style="margin:8px 0 16px;font-size:26px">Reset your password</h1><p style="line-height:1.6">Use this verification code to choose a new password for your ${safeBrandName} customer account:</p><p style="margin:24px 0;text-align:center;font-size:34px;letter-spacing:10px;font-weight:800;color:#12372a">${safeCode}</p><p style="line-height:1.6;color:#52645a">This code expires in ${minutes} minutes. If you did not request a password reset, you can safely ignore this email.</p></div></body></html>`;
  const text = `Reset your ${config.brandName} password\n\nYour verification code is: ${code}\n\nThis code expires in ${minutes} minutes. If you did not request a password reset, you can safely ignore this email.`;

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
        subject: `Your ${config.brandName} password reset code`,
        from: { name: config.fromName, email: config.fromEmail },
        to: [{ name: `${config.brandName} customer`, email }],
      },
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`SendPulse password reset email failed (${response.status})`);
  return { sent: true, response: data };
}

async function sendOwnerNotificationEmail({ subject, title, text, details = [] } = {}) {
  const config = getConfig();
  if (!config.enabled) return { sent: false, skipped: true, reason: "disabled" };
  if (!isSendPulseMailerConfigured()) return { sent: false, skipped: true, reason: "not_configured" };

  const recipientEmail = config.ownerEmail;
  if (!recipientEmail) return { sent: false, skipped: true, reason: "owner_email_missing" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return { sent: false, skipped: true, reason: "owner_email_invalid" };
  const fromEmail = config.adminFromEmail || config.fromEmail;
  if (!fromEmail) throw new Error("Configure a verified SendPulse sender email");
  if (fromEmail.toLowerCase() === recipientEmail.toLowerCase()) {
    throw new Error("SENDPULSE_ADMIN_FROM_EMAIL must be different from OWNER_EMAIL");
  }

  const safeTitle = escapeHtml(title || `${config.brandName} notification`);
  const safeSubject = String(subject || `${config.brandName} notification`).replace(/[\r\n]/g, " ").slice(0, 180);
  const safeText = String(text || "").slice(0, 8000);
  const normalizedDetails = (Array.isArray(details) ? details : [])
    .map((entry) => ({ label: String(entry?.label || "").slice(0, 120), value: String(entry?.value ?? "").slice(0, 1000) }))
    .filter((entry) => entry.label);
  const detailRows = normalizedDetails.map((entry) => `<tr><td style="padding:7px 0;color:#718278;vertical-align:top">${escapeHtml(entry.label)}</td><td style="padding:7px 0;font-weight:700;white-space:pre-wrap">${escapeHtml(entry.value)}</td></tr>`).join("");
  const safeBrandName = escapeHtml(config.brandName);
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f5;color:#132019;font-family:Arial,sans-serif"><div style="max-width:620px;margin:32px auto;padding:28px;background:#ffffff;border:1px solid #dbe7dc;border-radius:16px"><p style="color:#3e785e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${safeBrandName} OPERATIONS</p><h1 style="margin:8px 0 18px;font-size:26px">${safeTitle}</h1><table style="width:100%;border-collapse:collapse;font-size:14px">${detailRows}</table><hr style="border:0;border-top:1px solid #e6eee7;margin:22px 0"><div style="line-height:1.65;white-space:pre-wrap">${escapeHtml(safeText)}</div></div></body></html>`;
  const detailText = normalizedDetails.length ? `\n\n${normalizedDetails.map((entry) => `${entry.label}: ${entry.value}`).join("\n")}` : "";
  const token = await getAccessToken(config);
  const response = await fetchWithTimeout(`${config.apiBaseUrl}/smtp/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: {
        html: encodeBase64(html),
        text: encodeBase64(`${title || `${config.brandName} notification`}\n\n${safeText}${detailText}`),
        subject: safeSubject,
        from: { name: config.adminFromName || config.fromName, email: fromEmail },
        to: [{ name: config.ownerEmail, email: recipientEmail }],
      },
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`SendPulse owner notification failed (${response.status})`);
  return { sent: true, response: data };
}

module.exports = {
  buildCustomerJourneyEmail,
  isSendPulseConfigured,
  isSendPulseMailerConfigured,
  sendCustomerJourneyEmail,
  sendOwnerNotificationEmail,
  sendPasswordResetCodeEmail,
  sendSignupMarketingEmails,
  sendSupportTicketEmail,
  sendWelcomeEmail,
};
