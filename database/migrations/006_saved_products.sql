/* Persistent customer saved products. The legacy storefront uses integer User_tbl and Products_tbl ids. */
SET NOCOUNT ON;

IF OBJECT_ID(N'[dbo].[SavedProducts_tbl]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[SavedProducts_tbl] (
    [SavedProductId] BIGINT IDENTITY(1,1) NOT NULL,
    [UserId] INT NOT NULL,
    [ProductId] INT NOT NULL,
    [SavedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_SavedProducts_SavedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_SavedProducts_tbl] PRIMARY KEY CLUSTERED ([SavedProductId])
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'UX_SavedProducts_User_Product'
    AND [object_id] = OBJECT_ID(N'[dbo].[SavedProducts_tbl]')
)
  CREATE UNIQUE INDEX [UX_SavedProducts_User_Product]
    ON [dbo].[SavedProducts_tbl]([UserId], [ProductId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'IX_SavedProducts_User_SavedAt'
    AND [object_id] = OBJECT_ID(N'[dbo].[SavedProducts_tbl]')
)
  CREATE INDEX [IX_SavedProducts_User_SavedAt]
    ON [dbo].[SavedProducts_tbl]([UserId], [SavedAt] DESC);
