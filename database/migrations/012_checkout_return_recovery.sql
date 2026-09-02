IF OBJECT_ID(N'[Commerce].[SecureCheckoutSessions]', N'U') IS NULL
BEGIN
  THROW 50020, 'SecureCheckoutSessions must exist before applying checkout return recovery', 1;
END;

IF COL_LENGTH(N'Commerce.SecureCheckoutSessions', N'checkout_details_json') IS NULL
  ALTER TABLE [Commerce].[SecureCheckoutSessions] ADD [checkout_details_json] NVARCHAR(MAX) NULL;
