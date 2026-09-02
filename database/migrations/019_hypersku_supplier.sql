/* Register HyperSKU in the canonical supplier master. API secrets remain in
   the server environment and are never stored in Commerce.Suppliers. */
IF OBJECT_ID(N'[Commerce].[Suppliers]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM [Commerce].[Suppliers] WHERE [Code] = N'HYPERSKU')
BEGIN
  INSERT INTO [Commerce].[Suppliers] (
    [Code], [Name], [SupplierType], [Status], [Website], [DefaultCurrency], [CountryCode]
  )
  VALUES (
    N'HYPERSKU', N'HyperSKU', N'Dropshipping', N'Active',
    N'https://www.hypersku.com', N'USD', NULL
  );
END;

IF OBJECT_ID(N'[dbo].[WeluxoMigrationHistory]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM [dbo].[WeluxoMigrationHistory] WHERE [MigrationId] = N'019_hypersku_supplier')
BEGIN
  INSERT INTO [dbo].[WeluxoMigrationHistory] ([MigrationId], [Description])
  VALUES (N'019_hypersku_supplier', N'Register HyperSKU as an active canonical dropshipping supplier.');
END;
