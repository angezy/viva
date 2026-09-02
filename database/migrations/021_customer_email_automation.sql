/*
  Customer email automation queue
  Additive and idempotent. The backend only reads this table during requests;
  schema changes remain deployment-only through the migration runner.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.CustomerEmailQueue', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[CustomerEmailQueue] (
    [Id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_CustomerEmailQueue] PRIMARY KEY,
    [UserId] INT NOT NULL,
    [Email] NVARCHAR(255) NOT NULL,
    [RecipientName] NVARCHAR(250) NULL,
    [JourneyKey] NVARCHAR(120) NOT NULL,
    [StepKey] NVARCHAR(100) NOT NULL,
    [TriggerKey] NVARCHAR(80) NOT NULL,
    [MessageType] NVARCHAR(20) NOT NULL CONSTRAINT [DF_CustomerEmailQueue_MessageType] DEFAULT N'Marketing',
    [IsMarketing] BIT NOT NULL CONSTRAINT [DF_CustomerEmailQueue_IsMarketing] DEFAULT (1),
    [Subject] NVARCHAR(180) NOT NULL,
    [Body] NVARCHAR(MAX) NOT NULL,
    [Cta] NVARCHAR(80) NULL,
    [Href] NVARCHAR(500) NULL,
    [EventKey] NVARCHAR(180) NOT NULL,
    [OrderId] NVARCHAR(100) NULL,
    [ScheduledAt] DATETIME2(3) NOT NULL,
    [Status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_CustomerEmailQueue_Status] DEFAULT N'queued',
    [Attempts] INT NOT NULL CONSTRAINT [DF_CustomerEmailQueue_Attempts] DEFAULT (0),
    [LockedAt] DATETIME2(3) NULL,
    [SentAt] DATETIME2(3) NULL,
    [LastError] NVARCHAR(1000) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CustomerEmailQueue_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CustomerEmailQueue_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [CK_CustomerEmailQueue_Status] CHECK ([Status] IN (N'queued', N'processing', N'sent', N'failed', N'cancelled')),
    CONSTRAINT [CK_CustomerEmailQueue_Attempts] CHECK ([Attempts] >= 0),
    CONSTRAINT [CK_CustomerEmailQueue_MessageType] CHECK ([MessageType] IN (N'Marketing', N'Transactional'))
  );

  CREATE UNIQUE INDEX [UX_CustomerEmailQueue_Deduplication]
    ON [dbo].[CustomerEmailQueue] ([UserId], [JourneyKey], [StepKey], [EventKey]);

  CREATE INDEX [IX_CustomerEmailQueue_Due]
    ON [dbo].[CustomerEmailQueue] ([Status], [ScheduledAt], [LockedAt])
    INCLUDE ([UserId], [Email], [StepKey], [TriggerKey], [IsMarketing]);

  CREATE INDEX [IX_CustomerEmailQueue_User]
    ON [dbo].[CustomerEmailQueue] ([UserId], [Status], [CreatedAt]);
END;
