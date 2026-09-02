/* Persist the result of the CJ Store Product + Product Connection sync.
   The application keeps the legacy import mapping compatible with databases
   that have only applied migration 011, so these fields are optional at
   runtime until this migration is applied. */

IF OBJECT_ID(N'[Integration].[CjImportMappings]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'Integration.CjImportMappings', N'CjShopId') IS NULL
    ALTER TABLE [Integration].[CjImportMappings] ADD [CjShopId] NVARCHAR(50) NULL;

  IF COL_LENGTH(N'Integration.CjImportMappings', N'CjProductSaved') IS NULL
    ALTER TABLE [Integration].[CjImportMappings]
      ADD [CjProductSaved] BIT NOT NULL CONSTRAINT [DF_CjImportMappings_CjProductSaved] DEFAULT (0);

  IF COL_LENGTH(N'Integration.CjImportMappings', N'CjConnectionStatus') IS NULL
    ALTER TABLE [Integration].[CjImportMappings]
      ADD [CjConnectionStatus] NVARCHAR(30) NOT NULL CONSTRAINT [DF_CjImportMappings_CjConnectionStatus] DEFAULT (N'not_attempted');

  IF COL_LENGTH(N'Integration.CjImportMappings', N'CjConnectionError') IS NULL
    ALTER TABLE [Integration].[CjImportMappings] ADD [CjConnectionError] NVARCHAR(600) NULL;

  IF COL_LENGTH(N'Integration.CjImportMappings', N'CjLastSyncedAt') IS NULL
    ALTER TABLE [Integration].[CjImportMappings] ADD [CjLastSyncedAt] DATETIME2(3) NULL;
END;
