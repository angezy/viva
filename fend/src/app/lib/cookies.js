"use client";

export const CONSENT_COOKIE_NAME = "weluxo_consent";
export const CONSENT_VERSION = "1.0";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

const DEFAULT_CONSENT = Object.freeze({
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
  version: CONSENT_VERSION,
});

function canUseDocument() {
  return typeof document !== "undefined";
}

function encode(value) {
  return encodeURIComponent(String(value));
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
}

export function getCookie(name) {
  if (!canUseDocument()) return null;
  const prefix = `${encode(name)}=`;
  const entry = document.cookie.split(/;\s*/).find((item) => item.startsWith(prefix));
  return entry ? decode(entry.slice(prefix.length)) : null;
}

export function setCookie(name, value, options = {}) {
  if (!canUseDocument()) return;
  const attributes = [`${encode(name)}=${encode(value)}`, `Path=${options.path || "/"}`];
  if (options.maxAge != null) attributes.push(`Max-Age=${Math.max(0, Math.floor(Number(options.maxAge) || 0))}`);
  if (options.expires instanceof Date) attributes.push(`Expires=${options.expires.toUTCString()}`);
  if (options.domain) attributes.push(`Domain=${options.domain}`);
  if (options.sameSite) attributes.push(`SameSite=${options.sameSite}`);
  if (options.secure ?? window.location.protocol === "https:") attributes.push("Secure");
  document.cookie = attributes.join("; ");
}

export function deleteCookie(name, options = {}) {
  setCookie(name, "", { ...options, maxAge: 0 });
}

function normalizeConsent(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_CONSENT, timestamp: new Date().toISOString() };
  return {
    necessary: true,
    preferences: Boolean(value.preferences),
    analytics: Boolean(value.analytics),
    marketing: Boolean(value.marketing),
    version: String(value.version || CONSENT_VERSION),
    timestamp: value.timestamp || new Date().toISOString(),
  };
}

export function getConsent() {
  const raw = getCookie(CONSENT_COOKIE_NAME);
  if (!raw) return null;
  try {
    return normalizeConsent(JSON.parse(raw));
  } catch (_error) {
    return null;
  }
}

export function setConsent(value) {
  const consent = normalizeConsent(value);
  setCookie(CONSENT_COOKIE_NAME, JSON.stringify(consent), {
    maxAge: CONSENT_MAX_AGE,
    sameSite: "Lax",
  });
  return consent;
}

export function hasConsent(category) {
  if (category === "necessary") return true;
  return Boolean(getConsent()?.[category]);
}

export { DEFAULT_CONSENT };
