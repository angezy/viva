/* Weluxo customer reviews. Structure only; no review rows are inserted. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF SCHEMA_ID(N'CRM') IS NULL
    EXEC(N'CREATE SCHEMA [CRM]');

  IF OBJECT_ID(N'[CRM].[Reviews]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[Reviews] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_Reviews_Id] DEFAULT NEWSEQUENTIALID(),
      [CustomerId] UNIQUEIDENTIFIER NULL,
      [CustomerName] NVARCHAR(100) NOT NULL,
      [CustomerEmail] NVARCHAR(255) NULL,
      [Rating] TINYINT NOT NULL,
      [Title] NVARCHAR(160) NULL,
      [ReviewText] NVARCHAR(2000) NOT NULL,
      [Status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_CRM_Reviews_Status] DEFAULT N'Approved',
      [IsFeatured] BIT NOT NULL CONSTRAINT [DF_CRM_Reviews_IsFeatured] DEFAULT (0),
      [PublishedAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_Reviews_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_Reviews_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_Reviews] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [CK_CRM_Reviews_Rating] CHECK ([Rating] BETWEEN 1 AND 5),
      CONSTRAINT [CK_CRM_Reviews_Status] CHECK ([Status] IN (N'Pending', N'Approved', N'Rejected'))
    );

    IF OBJECT_ID(N'[CRM].[Customers]', N'U') IS NOT NULL
      ALTER TABLE [CRM].[Reviews] WITH CHECK ADD CONSTRAINT [FK_CRM_Reviews_Customer]
        FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]);
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_CRM_Reviews_Published' AND [object_id] = OBJECT_ID(N'[CRM].[Reviews]'))
    CREATE INDEX [IX_CRM_Reviews_Published]
      ON [CRM].[Reviews]([Status], [IsFeatured], [PublishedAt] DESC, [CreatedAt] DESC);

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_CRM_Reviews_Customer' AND [object_id] = OBJECT_ID(N'[CRM].[Reviews]'))
    CREATE INDEX [IX_CRM_Reviews_Customer]
      ON [CRM].[Reviews]([CustomerId], [CreatedAt] DESC);

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
