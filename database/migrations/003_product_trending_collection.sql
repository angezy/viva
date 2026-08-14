/* Weluxo product merchandising flag. Structure only; no data rows are changed. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'[dbo].[Products_tbl]', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH(N'dbo.Products_tbl', N'IsTrending') IS NULL
      ALTER TABLE [dbo].[Products_tbl] ADD [IsTrending] BIT NOT NULL
        CONSTRAINT [DF_Products_tbl_IsTrending] DEFAULT (0);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE [name] = N'IX_Products_tbl_IsTrending' AND [object_id] = OBJECT_ID(N'[dbo].[Products_tbl]')
    )
      CREATE INDEX [IX_Products_tbl_IsTrending]
        ON [dbo].[Products_tbl]([IsTrending], [Category], [PID]);
  END;

  IF OBJECT_ID(N'[Commerce].[Products]', N'U') IS NOT NULL
    AND COL_LENGTH(N'Commerce.Products', N'IsTrending') IS NULL
      ALTER TABLE [Commerce].[Products] ADD [IsTrending] BIT NOT NULL
        CONSTRAINT [DF_Commerce_Products_IsTrending_003] DEFAULT (0);

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
