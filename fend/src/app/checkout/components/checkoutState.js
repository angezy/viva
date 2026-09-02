export const CHECKOUT_STORAGE_KEY = "weluxo_checkout_state";

export const defaultCheckoutState = {
  information: {
    email: "",
    phone: "",
    subscribe: false,
    guest: true,
    ownerEmail: "",
  },
  shipping: {
    fullName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    country: "",
    postalCode: "",
    method: "",
    logisticName: "",
    label: "",
    window: "",
    cost: null,
    fromCountryCode: "",
    ownerEmail: "",
  },
  payment: {
    method: "card",
    cardholderName: "",
    billingSameAsShipping: true,
  },
  coupon: {
    code: "",
    discount: 0,
    discountPercent: 0,
    expiresAt: null,
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
      coupon: { ...defaultCheckoutState.coupon, ...(saved?.coupon || {}) },
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

export function reconcileCheckoutIdentity(state = readCheckoutState(), user) {
  const accountEmail = user?.guest ? "" : String(user?.email || "").trim().toLowerCase();
  if (!accountEmail) return state;

  const information = state?.information || {};
  const savedEmail = String(information.email || "").trim().toLowerCase();
  const savedOwnerEmail = String(information.ownerEmail || "").trim().toLowerCase();
  const belongsToAnotherAccount = savedOwnerEmail
    ? savedOwnerEmail !== accountEmail
    : Boolean(savedEmail && savedEmail !== accountEmail);
  const email = belongsToAnotherAccount || !savedEmail ? accountEmail : information.email;

  return {
    ...state,
    information: {
      ...information,
      email,
      ownerEmail: accountEmail,
    },
    shipping: belongsToAnotherAccount
      ? { ...defaultCheckoutState.shipping, method: state?.shipping?.method || defaultCheckoutState.shipping.method, ownerEmail: accountEmail }
      : { ...(state?.shipping || defaultCheckoutState.shipping), ownerEmail: accountEmail },
  };
}

function blank(value) {
  return !String(value || "").trim();
}

function defaultShippingAddress(addresses) {
  const shipping = Array.isArray(addresses) ? addresses.filter((address) => address?.addressType === "shipping") : [];
  return shipping.find((address) => address.isDefault) || shipping[0] || null;
}

// Server data fills only blank checkout fields so an in-progress edit is never
// overwritten. The account identity is recorded with the temporary browser state
// to prevent one signed-in customer seeing another customer's local details.
export function hydrateCheckoutFromAccount(state = readCheckoutState(), user, accountDetails) {
  const previousOwnerEmail = String(state?.information?.ownerEmail || "").trim().toLowerCase();
  const checkout = reconcileCheckoutIdentity(state, user);
  const accountEmail = user?.guest ? "" : String(user?.email || "").trim().toLowerCase();
  if (!accountEmail) return checkout;

  const savedAddress = defaultShippingAddress(accountDetails?.addresses);
  const savedFullName = savedAddress ? [savedAddress.firstName, savedAddress.lastName].filter(Boolean).join(" ") : "";
  const profilePhone = String(accountDetails?.profile?.phone || savedAddress?.phone || "").trim();
  const currentShipping = checkout.shipping || defaultCheckoutState.shipping;
  const shipping = {
    ...currentShipping,
    fullName: blank(currentShipping.fullName) ? savedFullName : currentShipping.fullName,
    addressLine1: blank(currentShipping.addressLine1) ? (savedAddress?.addressLine1 || "") : currentShipping.addressLine1,
    addressLine2: blank(currentShipping.addressLine2) ? (savedAddress?.addressLine2 || "") : currentShipping.addressLine2,
    city: blank(currentShipping.city) ? (savedAddress?.city || "") : currentShipping.city,
    region: blank(currentShipping.region) ? (savedAddress?.stateProvince || "") : currentShipping.region,
    country: blank(currentShipping.country) ? (savedAddress?.country || "") : currentShipping.country,
    postalCode: blank(currentShipping.postalCode) ? (savedAddress?.postalCode || "") : currentShipping.postalCode,
    ownerEmail: accountEmail,
  };

  return {
    ...checkout,
    information: {
      ...checkout.information,
      email: accountEmail,
      phone: blank(checkout.information?.phone) ? profilePhone : checkout.information.phone,
      subscribe: previousOwnerEmail === accountEmail
        ? Boolean(checkout.information?.subscribe)
        : Boolean(accountDetails?.preferences?.emailMarketing),
      ownerEmail: accountEmail,
    },
    shipping,
  };
}

export function clearCheckoutState() {
  if (typeof window !== "undefined") window.localStorage.removeItem(CHECKOUT_STORAGE_KEY);
}

export function shippingCost(shipping) {
  if (shipping && typeof shipping === "object") {
    const amount = Number(shipping.cost);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }
  return shipping === "express" ? 19.99 : 0;
}

export function shippingLabel(shipping) {
  if (shipping && typeof shipping === "object") {
    return String(shipping.label || shipping.logisticName || shipping.method || "Shipping");
  }
  if (!shipping) return "Shipping";
  return shipping === "express" ? "Express Shipping" : shipping === "standard" ? "Standard Shipping" : String(shipping);
}

export function isInformationComplete(state = readCheckoutState()) {
  return Boolean(state?.information?.email?.trim() && state?.information?.phone?.trim());
}

export function isShippingComplete(state = readCheckoutState()) {
  const shipping = state?.shipping || {};
  return ["fullName", "addressLine1", "city", "region", "country", "postalCode", "method"]
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

export function shippingWindow(shipping) {
  if (shipping && typeof shipping === "object") return String(shipping.window || "Delivery estimate pending");
  return shipping === "express" ? "3–7 business days" : shipping === "standard" ? "7–15 business days" : "Delivery estimate pending";
}
