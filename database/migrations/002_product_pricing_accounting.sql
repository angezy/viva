/*
  Weluxo product pricing/accounting extension.

  This migration contains structure only. It adds durable buy/sale pricing to
  the legacy catalog when that table is present and verifies the canonical
  variant pricing fields used by accounting. No data rows are inserted or
  updated here.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'[dbo].[Products_tbl]', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH(N'dbo.Products_tbl', N'BuyPrice') IS NULL
      ALTER TABLE [dbo].[Products_tbl] ADD [BuyPrice] DECIMAL(19,4) NULL;

    IF COL_LENGTH(N'dbo.Products_tbl', N'SalePrice') IS NULL
      ALTER TABLE [dbo].[Products_tbl] ADD [SalePrice] DECIMAL(19,4) NULL;

    -- SQL Server compiles a batch before preceding ALTER TABLE statements add
    -- columns, so late-bound column references must execute dynamically.
    IF NOT EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE [name] = N'CK_Products_tbl_Pricing' AND [parent_object_id] = OBJECT_ID(N'[dbo].[Products_tbl]')
    )
      EXEC sys.sp_executesql N'
        ALTER TABLE [dbo].[Products_tbl] WITH CHECK ADD CONSTRAINT [CK_Products_tbl_Pricing]
          CHECK (([BuyPrice] IS NULL OR [BuyPrice] >= 0) AND ([SalePrice] IS NULL OR [SalePrice] >= 0));';

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE [name] = N'IX_Products_tbl_Pricing' AND [object_id] = OBJECT_ID(N'[dbo].[Products_tbl]')
    )
      EXEC sys.sp_executesql N'
        CREATE INDEX [IX_Products_tbl_Pricing] ON [dbo].[Products_tbl]([SalePrice], [BuyPrice]);';
  END;

  IF OBJECT_ID(N'[Commerce].[ProductVariants]', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH(N'Commerce.ProductVariants', N'CostPrice') IS NULL
      ALTER TABLE [Commerce].[ProductVariants] ADD [CostPrice] DECIMAL(19,4) NOT NULL
        CONSTRAINT [DF_Commerce_ProductVariants_CostPrice_002] DEFAULT (0);

    IF COL_LENGTH(N'Commerce.ProductVariants', N'SellingPrice') IS NULL
      ALTER TABLE [Commerce].[ProductVariants] ADD [SellingPrice] DECIMAL(19,4) NOT NULL
        CONSTRAINT [DF_Commerce_ProductVariants_SellingPrice_002] DEFAULT (0);

    IF COL_LENGTH(N'Commerce.ProductVariants', N'Currency') IS NULL
      ALTER TABLE [Commerce].[ProductVariants] ADD [Currency] CHAR(3) NOT NULL
        CONSTRAINT [DF_Commerce_ProductVariants_Currency_002] DEFAULT ('USD');

    IF NOT EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE [name] = N'CK_Commerce_ProductVariants_Prices_002'
        AND [parent_object_id] = OBJECT_ID(N'[Commerce].[ProductVariants]')
    )
      EXEC sys.sp_executesql N'
        ALTER TABLE [Commerce].[ProductVariants] WITH CHECK ADD CONSTRAINT [CK_Commerce_ProductVariants_Prices_002]
          CHECK ([CostPrice] >= 0 AND [SellingPrice] >= 0);';

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE [name] = N'IX_Commerce_ProductVariants_Accounting'
        AND [object_id] = OBJECT_ID(N'[Commerce].[ProductVariants]')
    )
      EXEC sys.sp_executesql N'
        CREATE INDEX [IX_Commerce_ProductVariants_Accounting]
          ON [Commerce].[ProductVariants]([Status], [Currency], [CostPrice], [SellingPrice]);';
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
