// Browser requests stay on the public frontend origin. Next.js proxies /api
// server-side using BACKEND_URL, so a deployed browser never calls localhost.
import { endLiveChatSession } from "./chatSession";

export const API_BASE = "";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch (_err) {
    return null;
  }
}

export async function loginRequest(email, password, expectedRole) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, expectedRole }),
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const message = data?.error || data?.message || `Login failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

async function passwordResetRequest(path, body, fallbackMessage) {
  const res = await fetch(`${API_BASE}/api/password-reset/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `${fallbackMessage} (${res.status})`);
  }
  return data || {};
}

export function requestPasswordReset(email) {
  return passwordResetRequest("request", { email }, "Unable to send reset code");
}

export function verifyPasswordResetCode(email, code) {
  return passwordResetRequest("verify", { email, code }, "Unable to verify reset code");
}

export function resetPassword(email, resetToken, password) {
  return passwordResetRequest("reset", { email, resetToken, password }, "Unable to reset password");
}

export async function logoutRequest() {
  await endLiveChatSession();
  await fetch(`${API_BASE}/api/auth/signout?role=customer`, { credentials: "include" });
}

export async function fetchSession() {
  const res = await fetch(`${API_BASE}/api/session`, { credentials: "include" });
  if (res.status === 401) return null;
  const data = await parseJsonSafe(res);
  return data?.user ? data : null;
}

export async function fetchProfile() {
  const res = await fetch(`${API_BASE}/api/profile`, { credentials: "include" });
  if (res.status === 401) return null;
  const data = await parseJsonSafe(res);
  return data;
}

export async function updateProfileName(username) {
  const res = await fetch(`${API_BASE}/api/profile/name`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const message = data?.error || data?.message || `Update failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export async function fetchOrders() {
  const res = await fetch(`${API_BASE}/api/orders`, { credentials: "include" });
  if (res.status === 401) return { orders: [] };
  const data = await parseJsonSafe(res);
  return data || { orders: [] };
}

export async function fetchOrderById(orderId) {
  const res = await fetch(`${API_BASE}/api/orders/track/${encodeURIComponent(orderId)}`, {
    credentials: "include",
  });
  if (res.status === 401) throw new Error("unauthorized");
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Order lookup failed (${res.status})`);
  }
  return data;
}

export async function checkoutCart(details = {}) {
  const hasDetails = details && typeof details === "object" && Object.keys(details).length > 0;
  const res = await fetch(`${API_BASE}/api/orders/checkout`, {
    method: "POST",
    headers: hasDetails ? { "Content-Type": "application/json" } : undefined,
    body: hasDetails ? JSON.stringify(details) : undefined,
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data?.error || "Checkout failed");
  }
  return data;
}

function notifyCartUpdated(data) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("weluxo:cart-updated", { detail: data || { items: [], subtotal: 0 } }));
  }
}

export async function createPayment(details) {
  const res = await fetch(`${API_BASE}/api/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Unable to start payment");
  return data;
}

export async function confirmPayment(details) {
  const res = await fetch(`${API_BASE}/api/payment/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Payment failed");
  return data;
}

export async function createOrder(details) {
  const res = await fetch(`${API_BASE}/api/orders/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Unable to create order");
  return data;
}

export async function fetchCart() {
  const res = await fetch(`${API_BASE}/api/cart`, { credentials: "include" });
  if (res.status === 401) {
    throw new Error("unauthorized");
  }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || "Failed to load cart");
  return data || { items: [], subtotal: 0 };
}

export async function addToCart(item) {
  const res = await fetch(`${API_BASE}/api/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(item),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Add to cart failed");
  notifyCartUpdated(data);
  return data;
}

export async function updateCartItem(productId, quantity) {
  const res = await fetch(`${API_BASE}/api/cart/${encodeURIComponent(productId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ quantity }),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Update cart failed");
  notifyCartUpdated(data);
  return data;
}

export async function removeCartItem(productId) {
  const res = await fetch(`${API_BASE}/api/cart/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Remove cart failed");
  notifyCartUpdated(data);
  return data;
}

export async function applyCartCoupon(code) {
  const res = await fetch(`${API_BASE}/api/cart/apply-coupon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Unable to apply coupon");
  return data;
}

export async function estimateCartShipping(details) {
  const res = await fetch(`${API_BASE}/api/cart/shipping-estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(details),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Unable to estimate shipping");
  return data;
}

export async function saveCartItem(item) {
  const res = await fetch(`${API_BASE}/api/cart/save-item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(item),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Unable to save item");
  notifyCartUpdated(data);
  return data;
}

export async function fetchSavedProducts() {
  const res = await fetch(`${API_BASE}/api/saved-products`, { credentials: "include", cache: "no-store" });
  if (res.status === 401) throw new Error("unauthorized");
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || "Unable to load saved products");
  return data || { items: [] };
}

export async function saveProduct(productId) {
  const res = await fetch(`${API_BASE}/api/saved-products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productId }),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Unable to save product");
  return data;
}

export async function removeSavedProduct(productId) {
  const res = await fetch(`${API_BASE}/api/saved-products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(data?.error || "Unable to remove saved product");
  return data;
}
