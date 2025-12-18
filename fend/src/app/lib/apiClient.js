export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

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

export async function logoutRequest() {
  await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" });
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

export async function checkoutCart() {
  const res = await fetch(`${API_BASE}/api/orders/checkout`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data?.error || "Checkout failed");
  }
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
  return data;
}
