const ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  CUSTOMER: "customer",
});

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === ROLES.OWNER) return ROLES.OWNER;
  if (role === ROLES.ADMIN) return ROLES.ADMIN;
  // `user` is the legacy customer role used by existing installations.
  return ROLES.CUSTOMER;
}

function isStaffRole(value) {
  const role = normalizeRole(value);
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

module.exports = { ROLES, isStaffRole, normalizeRole };
