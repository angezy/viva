-- Weluxo customer support ticket system schema for Microsoft SQL Server.
-- The API also creates these tables lazily on its first support request.
IF OBJECT_ID(N'[dbo].[tickets]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[tickets] (
    [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tickets PRIMARY KEY,
    [ticket_number] NVARCHAR(40) NOT NULL,
    [user_id] INT NULL,
    [order_id] NVARCHAR(100) NULL,
    [category] NVARCHAR(60) NOT NULL,
    [priority] NVARCHAR(20) NOT NULL CONSTRAINT DF_tickets_priority DEFAULT N'Normal',
    [status] NVARCHAR(40) NOT NULL CONSTRAINT DF_tickets_status DEFAULT N'New',
    [subject] NVARCHAR(240) NOT NULL,
    [customer_name] NVARCHAR(200) NOT NULL,
    [customer_email] NVARCHAR(255) NOT NULL,
    [assigned_agent_id] INT NULL,
    [tags] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT DF_tickets_created_at DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT DF_tickets_updated_at DEFAULT SYSUTCDATETIME()
  );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_tickets_ticket_number' AND object_id = OBJECT_ID(N'[dbo].[tickets]')) CREATE UNIQUE INDEX UX_tickets_ticket_number ON [dbo].[tickets]([ticket_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tickets_user_id' AND object_id = OBJECT_ID(N'[dbo].[tickets]')) CREATE INDEX IX_tickets_user_id ON [dbo].[tickets]([user_id], [updated_at] DESC);

IF OBJECT_ID(N'[dbo].[ticket_messages]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ticket_messages] (
    [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ticket_messages PRIMARY KEY,
    [ticket_id] INT NOT NULL,
    [sender_id] INT NULL,
    [sender_type] NVARCHAR(20) NOT NULL,
    [visibility] NVARCHAR(20) NOT NULL CONSTRAINT DF_ticket_messages_visibility DEFAULT N'public',
    [content_html] NVARCHAR(MAX) NOT NULL,
    [content_text] NVARCHAR(MAX) NOT NULL,
    [attachments] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT DF_ticket_messages_created_at DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_ticket_messages_ticket_id ON [dbo].[ticket_messages]([ticket_id], [created_at]);
END;

IF OBJECT_ID(N'[dbo].[ticket_events]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ticket_events] (
    [id] INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ticket_events PRIMARY KEY,
    [ticket_id] INT NOT NULL,
    [actor_id] INT NULL,
    [action] NVARCHAR(80) NOT NULL,
    [old_value] NVARCHAR(MAX) NULL,
    [new_value] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT DF_ticket_events_created_at DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_ticket_events_ticket_id ON [dbo].[ticket_events]([ticket_id], [created_at]);
END;
