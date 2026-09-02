/*
  Fresh empty-database SQLCMD artifact.
  Run from the repository root with -d set to the configured new database.
  It includes schema and system reference data only; it never selects from or
  restores another database.
*/
:r scripts/create_database.sql
:r database/migrations/001_weluxo_platform_upgrade.sql
:r database/migrations/002_product_pricing_accounting.sql
:r database/migrations/003_product_trending_collection.sql
:r database/migrations/004_customer_reviews.sql
:r database/migrations/005_coupons.sql
:r database/migrations/006_saved_products.sql
:r database/migrations/007_coupon_redemptions.sql
:r database/migrations/008_customer_account_features.sql
:r database/migrations/009_security_and_checkout_hardening.sql
:r database/migrations/010_site_settings_green_palette.sql
:r database/migrations/011_security_completion.sql
:r database/migrations/012_checkout_return_recovery.sql
:r database/migrations/013_fix_seed_admin_signin.sql
:r database/migrations/014_cj_fulfillment_orders.sql
:r database/migrations/015_legacy_product_inventory_mappings.sql
:r database/migrations/016_remove_supplier_branding.sql
:r database/migrations/017_cj_dynamic_shipping.sql
:r database/migrations/018_cj_store_product_connections.sql
:r database/migrations/019_hypersku_supplier.sql
:r database/migrations/020_rbac_roles_permissions.sql
:r database/migrations/021_customer_email_automation.sql
:r database/seeds/seed-system.sql
