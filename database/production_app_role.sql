/*
  REVIEW BEFORE USE. Run only after migration 011 and schema verification.
  Replace [store_app] with the actual production database user.
  This script intentionally grants DML and denies DDL; it does not create users.
*/
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[Commerce] TO [store_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[CRM] TO [store_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[ERP] TO [store_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[Security] TO [store_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[Integration] TO [store_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[dbo] TO [store_app];

DENY CREATE TABLE TO [store_app];
DENY CREATE VIEW TO [store_app];
DENY CREATE PROCEDURE TO [store_app];
DENY ALTER ANY SCHEMA TO [store_app];
DENY ALTER ANY DATABASE DDL TRIGGER TO [store_app];
DENY CONTROL DATABASE TO [store_app];
DENY VIEW DEFINITION TO [store_app];
