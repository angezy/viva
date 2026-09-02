SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'[Commerce].[SecureCheckoutSessions]', N'U') IS NOT NULL
BEGIN
  IF OBJECT_ID(N'[Commerce].[CK_SecureCheckoutSessions_shipping_method]', N'C') IS NOT NULL
    ALTER TABLE [Commerce].[SecureCheckoutSessions]
      DROP CONSTRAINT [CK_SecureCheckoutSessions_shipping_method];

  ALTER TABLE [Commerce].[SecureCheckoutSessions]
    ALTER COLUMN [shipping_method] NVARCHAR(200) NOT NULL;
END;
