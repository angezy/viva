# Weluxo Security Deployment Runbook

## 1. Restore-clone and migrate

Use a database whose name clearly contains `staging`, `test`, `security`, or `clone`. Configure `MIGRATION_DB_*` with a deployment-only principal, not the web application's `DB_USER`.

```powershell
cd bend
npm.cmd run migrate:security:plan
$env:ALLOW_SCHEMA_MIGRATIONS='true'
$env:MIGRATION_IDENTITY_CONFIRMED='true'
$env:BACKUP_RESTORE_CONFIRMED='true'
npm.cmd run migrate:security:apply
npm.cmd run migrate:security:verify
```

Review and replace the `[weluxo_app]` placeholder in `database/production_app_role.sql`, apply it after verification, and confirm the application identity cannot create/alter/drop objects.

## 2. Run database security proofs

Point `DB_*` at the clone. The suite creates uniquely named fixtures and cleans them up.

```powershell
$env:SECURITY_TEST_DB='true'
$env:ALLOW_SECURITY_DB_TESTS='true'
npm.cmd run test:security-db
```

Do not change the database-name guard to run this against production.

## 3. Migrate support attachments

Start with counts-only dry runs:

```powershell
npm.cmd run uploads:migrate:dry-run
npm.cmd run uploads:cleanup:dry-run
```

After reviewing the database clone and restore procedure:

```powershell
$env:ALLOW_LEGACY_ATTACHMENT_MIGRATION='true'
node scripts/migrateLegacySupportAttachments.js --apply
$env:ALLOW_ORPHAN_UPLOAD_CLEANUP='true'
node scripts/cleanupOrphanUploads.js --apply
```

Verify anonymous access returns 401/404, Customer A cannot fetch Customer B's file, the owner can download it, and an admin can download it. Confirm old public URLs fail.

## 4. Scanner, CSP, and edge rollout

- Configure `MALWARE_SCANNER_MODE=clamav` (or `clamscan`/`clamdscan`) and verify clean, EICAR, malformed, timeout, and scanner-offline cases.
- Start with `CSP_REPORT_ONLY=true`; inspect `csp.violation` events, then set it to `false` after Stripe and TinyMCE staging tests.
- Use exact `FRONTEND_URL`, `CORS_ORIGINS`, and `TRUST_PROXY_CIDRS`; never enable blanket `TRUST_PROXY=true`.
- Restrict origin ingress to the load balancer/Cloudflare, force HTTP to HTTPS there, and bypass caches for cookies and `/api/*`.

## 5. Monitoring

Alert on these `Integration.SecurityEvents.event_type` values:

- `webhook.stripe_invalid_signature`, `webhook.stripe_event_collision`, `webhook.stripe_failed`
- `abuse.rate_limit_block`, `abuse.rate_limit_unavailable`
- `auth.session_store_unavailable`, high-volume password-reset events
- `admin.refund_inventory_decision` and unusual admin mutation volume
- `csp.violation` spikes

Recommended initial policy: critical immediately; 5 high events of one type in 10 minutes; 25 warnings of one type in 10 minutes. Retain security events for at least 180 days, restrict access to security/operations roles, and export longer-term records to the SIEM.
