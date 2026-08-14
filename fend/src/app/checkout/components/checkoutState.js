export const CHECKOUT_STORAGE_KEY = "weluxo_checkout_state";

export const defaultCheckoutState = {
  information: {
    email: "",
    phone: "",
    subscribe: false,
    guest: true,
  },
  shipping: {
    fullName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    country: "",
    postalCode: "",
    method: "standard",
  },
  payment: {
    method: "card",
    cardholderName: "",
    billingSameAsShipping: true,
  },
};

export function readCheckoutState() {
  if (typeof window === "undefined") return defaultCheckoutState;
  try {
    const saved = JSON.parse(window.localStorage.getItem(CHECKOUT_STORAGE_KEY) || "null");
    return {
      ...defaultCheckoutState,
      ...saved,
      information: { ...defaultCheckoutState.information, ...(saved?.information || {}) },
      shipping: { ...defaultCheckoutState.shipping, ...(saved?.shipping || {}) },
      payment: { ...defaultCheckoutState.payment, ...(saved?.payment || {}) },
    };
  } catch (_error) {
    return defaultCheckoutState;
  }
}

export function writeCheckoutState(nextState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(nextState));
}

export function updateCheckoutState(patch) {
  const nextState = {
    ...readCheckoutState(),
    ...patch,
  };
  writeCheckoutState(nextState);
  return nextState;
}

export function clearCheckoutState() {
  if (typeof window !== "undefined") window.localStorage.removeItem(CHECKOUT_STORAGE_KEY);
}

export function shippingCost(method) {
  return method === "express" ? 19.99 : 0;
}

export function shippingLabel(method) {
  return method === "express" ? "Express Shipping" : "Standard Shipping";
}

export function isInformationComplete(state = readCheckoutState()) {
  return Boolean(state?.information?.email?.trim() && state?.information?.phone?.trim());
}

export function isShippingComplete(state = readCheckoutState()) {
  const shipping = state?.shipping || {};
  return ["fullName", "addressLine1", "city", "region", "country", "postalCode"]
    .every((field) => Boolean(String(shipping[field] || "").trim()));
}

export function isPaymentComplete(state = readCheckoutState()) {
  const payment = state?.payment || {};
  if (!payment.method) return false;
  return payment.method !== "card" || Boolean(payment.cardholderName?.trim());
}

export function canAccessCheckoutStep(state = readCheckoutState(), step) {
  if (step === "overview" || step === "information") return true;
  if (step === "shipping") return isInformationComplete(state);
  if (step === "payment") return isInformationComplete(state) && isShippingComplete(state);
  if (step === "confirmation") return isInformationComplete(state) && isShippingComplete(state) && isPaymentComplete(state);
  return false;
}

export function shippingWindow(method) {
  return method === "express" ? "3–7 business days" : "7–15 business days";
}
