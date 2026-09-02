/*
  Retained migration number for installations that previously applied the
  development seed repair. Seeded staff accounts are no longer supported;
  owner creation is handled by scripts/bootstrap_owner.js with an explicit
  environment-provided password. This migration is intentionally a no-op.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
