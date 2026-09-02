/*
  Durable storefront-product to canonical-inventory mapping.

  Commerce.Products.LegacyProductId is an identity column. Products created
  after the original legacy import can therefore have a different identity
  value from dbo.Products_tbl.PID. Checkout must not infer that relationship
  from matching identities.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'[Commerce].[LegacyProductInventoryMappings]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[LegacyProductInventoryMappings] (
      [LegacyProductId] INT NOT NULL,
      [ProductId] UNIQUEIDENTIFIER NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_LegacyProductInventoryMappings_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_LegacyProductInventoryMappings_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_LegacyProductInventoryMappings] PRIMARY KEY CLUSTERED ([LegacyProductId]),
      CONSTRAINT [UQ_LegacyProductInventoryMappings_Product] UNIQUE NONCLUSTERED ([ProductId]),
      CONSTRAINT [FK_LegacyProductInventoryMappings_Product] FOREIGN KEY ([ProductId])
        REFERENCES [Commerce].[Products]([Id]) ON DELETE CASCADE
    );
  END;

  /* The original migration used this exact relationship. */
  IF OBJECT_ID(N'[dbo].[Products_tbl]', N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.Products_tbl', N'PID') IS NOT NULL
  BEGIN
    INSERT INTO [Commerce].[LegacyProductInventoryMappings] ([LegacyProductId], [ProductId])
    SELECT p.[PID], cp.[Id]
    FROM [dbo].[Products_tbl] p
    INNER JOIN [Commerce].[Products] cp ON cp.[LegacyProductId] = p.[PID]
    WHERE NOT EXISTS (
      SELECT 1 FROM [Commerce].[LegacyProductInventoryMappings] m
      WHERE m.[LegacyProductId] = p.[PID] OR m.[ProductId] = cp.[Id]
    );

    /* Repair rows created by the storefront synchronization code before this migration. */
    INSERT INTO [Commerce].[LegacyProductInventoryMappings] ([LegacyProductId], [ProductId])
    SELECT p.[PID], cp.[Id]
    FROM [dbo].[Products_tbl] p
    INNER JOIN [Commerce].[Products] cp
      ON cp.[SKU] IN (CONCAT(N'LEGACY-', CONVERT(NVARCHAR(20), p.[PID])), CONVERT(NVARCHAR(20), p.[PID]))
    WHERE NOT EXISTS (
      SELECT 1 FROM [Commerce].[LegacyProductInventoryMappings] m
      WHERE m.[LegacyProductId] = p.[PID] OR m.[ProductId] = cp.[Id]
    );
  END;

  IF NOT EXISTS (SELECT 1 FROM [dbo].[WeluxoMigrationHistory] WHERE [MigrationId] = N'015_legacy_product_inventory_mappings')
  BEGIN
    INSERT INTO [dbo].[WeluxoMigrationHistory] ([MigrationId], [Description])
    VALUES (N'015_legacy_product_inventory_mappings', N'Durable legacy storefront product to canonical inventory mapping.');
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
