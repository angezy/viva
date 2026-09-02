/* Security controls, durable checkout state, webhook idempotency, chat and support storage.
   Apply with a migration principal before deploying the matching application code. */
SET XACT_ABORT ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Security') EXEC(N'CREATE SCHEMA [Security] AUTHORIZATION [dbo]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Integration') EXEC(N'CREATE SCHEMA [Integration] AUTHORIZATION [dbo]');

IF OBJECT_ID(N'[Security].[RateLimitBuckets]', N'U') IS NULL
BEGIN
  CREATE TABLE [Security].[RateLimitBuckets] (
    [bucket_key] CHAR(64) NOT NULL,
    [policy] NVARCHAR(80) NOT NULL,
    [hit_count] INT NOT NULL,
    [reset_at] DATETIME2(3) NOT NULL,
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_RateLimitBuckets_updated] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_RateLimitBuckets] PRIMARY KEY ([bucket_key], [policy]),
    CONSTRAINT [CK_RateLimitBuckets_count] CHECK ([hit_count] >= 0)
  );
  CREATE INDEX [IX_RateLimitBuckets_reset] ON [Security].[RateLimitBuckets]([reset_at]);
END;

IF OBJECT_ID(N'[Commerce].[SecureCheckoutSessions]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[SecureCheckoutSessions] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_SecureCheckoutSessions_id] DEFAULT NEWSEQUENTIALID(),
    [provider_session_id] NVARCHAR(255) NULL,
    [user_key] NVARCHAR(128) NOT NULL,
    [cart_json] NVARCHAR(MAX) NOT NULL,
    [currency] CHAR(3) NOT NULL,
    [subtotal_amount] DECIMAL(19,4) NOT NULL,
    [discount_amount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_SecureCheckoutSessions_discount] DEFAULT (0),
    [shipping_amount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_SecureCheckoutSessions_shipping] DEFAULT (0),
    [total_amount] DECIMAL(19,4) NOT NULL,
    [coupon_code] NVARCHAR(64) NULL,
    [shipping_method] NVARCHAR(20) NOT NULL,
    [customer_email] NVARCHAR(255) NOT NULL,
    [checkout_status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_SecureCheckoutSessions_status] DEFAULT N'Reserving',
    [payment_status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_SecureCheckoutSessions_payment] DEFAULT N'Pending',
    [order_id] NVARCHAR(64) NULL,
    [expires_at] DATETIME2(3) NOT NULL,
    [paid_at] DATETIME2(3) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_SecureCheckoutSessions_created] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_SecureCheckoutSessions_updated] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_SecureCheckoutSessions] PRIMARY KEY ([id]),
    CONSTRAINT [CK_SecureCheckoutSessions_amounts] CHECK ([subtotal_amount] >= 0 AND [discount_amount] >= 0 AND [shipping_amount] >= 0 AND [total_amount] >= 0),
    CONSTRAINT [CK_SecureCheckoutSessions_shipping_method] CHECK ([shipping_method] IN (N'standard', N'express'))
  );
  CREATE UNIQUE INDEX [UX_SecureCheckoutSessions_provider] ON [Commerce].[SecureCheckoutSessions]([provider_session_id]) WHERE [provider_session_id] IS NOT NULL;
  CREATE INDEX [IX_SecureCheckoutSessions_user] ON [Commerce].[SecureCheckoutSessions]([user_key], [created_at] DESC);
  CREATE INDEX [IX_SecureCheckoutSessions_expiry] ON [Commerce].[SecureCheckoutSessions]([checkout_status], [expires_at]);
END;

IF OBJECT_ID(N'[Commerce].[InventoryReservations]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[InventoryReservations] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_InventoryReservations_id] DEFAULT NEWSEQUENTIALID(),
    [checkout_id] UNIQUEIDENTIFIER NOT NULL,
    [variant_id] UNIQUEIDENTIFIER NOT NULL,
    [legacy_product_id] INT NULL,
    [quantity] DECIMAL(19,4) NOT NULL,
    [reservation_status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_InventoryReservations_status] DEFAULT N'Active',
    [expires_at] DATETIME2(3) NOT NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_InventoryReservations_created] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_InventoryReservations_updated] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_InventoryReservations] PRIMARY KEY ([id]),
    CONSTRAINT [FK_InventoryReservations_checkout] FOREIGN KEY ([checkout_id]) REFERENCES [Commerce].[SecureCheckoutSessions]([id]),
    CONSTRAINT [FK_InventoryReservations_variant] FOREIGN KEY ([variant_id]) REFERENCES [Commerce].[ProductVariants]([Id]),
    CONSTRAINT [UQ_InventoryReservations_checkout_variant] UNIQUE ([checkout_id], [variant_id]),
    CONSTRAINT [CK_InventoryReservations_quantity] CHECK ([quantity] > 0),
    CONSTRAINT [CK_InventoryReservations_status] CHECK ([reservation_status] IN (N'Active', N'Consumed', N'Released', N'Expired'))
  );
  CREATE INDEX [IX_InventoryReservations_expiry] ON [Commerce].[InventoryReservations]([reservation_status], [expires_at]);
END;

IF OBJECT_ID(N'[Integration].[WebhookEvents]', N'U') IS NULL
BEGIN
  CREATE TABLE [Integration].[WebhookEvents] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [provider] NVARCHAR(40) NOT NULL,
    [event_id] NVARCHAR(255) NOT NULL,
    [event_type] NVARCHAR(120) NOT NULL,
    [payload_hash] CHAR(64) NOT NULL,
    [processing_status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_WebhookEvents_status] DEFAULT N'Processing',
    [error_message] NVARCHAR(1000) NULL,
    [received_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_WebhookEvents_received] DEFAULT SYSUTCDATETIME(),
    [processed_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_WebhookEvents] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_WebhookEvents_provider_event] UNIQUE ([provider], [event_id])
  );
END;

IF OBJECT_ID(N'dbo.password_reset_codes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.password_reset_codes (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY, UserID INT NOT NULL, Email NVARCHAR(255) NOT NULL,
    CodeHash NVARCHAR(64) NOT NULL, ResetTokenHash NVARCHAR(64) NULL,
    ExpiresAt DATETIME2(3) NOT NULL, Attempts INT NOT NULL CONSTRAINT DF_password_reset_attempts DEFAULT (0),
    VerifiedAt DATETIME2(3) NULL, UsedAt DATETIME2(3) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_password_reset_created DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_password_reset_codes_Email_CreatedAt ON dbo.password_reset_codes(Email, CreatedAt DESC);
END;

IF OBJECT_ID(N'dbo.chat_conversations', N'U') IS NULL
  CREATE TABLE dbo.chat_conversations (conversation_id NVARCHAR(80) NOT NULL PRIMARY KEY, created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(), updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID(N'dbo.chat_messages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.chat_messages (message_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY, conversation_id NVARCHAR(80) NOT NULL, sender_type NVARCHAR(20) NOT NULL, content_text NVARCHAR(4000) NOT NULL, telegram_message_id BIGINT NULL, created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME());
  CREATE INDEX IX_chat_messages_conversation_id_message_id ON dbo.chat_messages(conversation_id, message_id);
  CREATE UNIQUE INDEX UX_chat_messages_telegram_message_id ON dbo.chat_messages(telegram_message_id) WHERE telegram_message_id IS NOT NULL;
END;
IF OBJECT_ID(N'dbo.chat_visitors', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.chat_visitors (conversation_id NVARCHAR(80) NOT NULL PRIMARY KEY, customer_name NVARCHAR(200) NOT NULL, customer_email NVARCHAR(255) NOT NULL, created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(), updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME());
  CREATE INDEX IX_chat_visitors_email ON dbo.chat_visitors(customer_email);
END;

IF OBJECT_ID(N'dbo.tickets', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tickets (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, ticket_number NVARCHAR(40) NOT NULL UNIQUE, user_id INT NULL, order_id NVARCHAR(100) NULL, category NVARCHAR(60) NOT NULL, priority NVARCHAR(20) NOT NULL DEFAULT N'Normal', subject NVARCHAR(240) NOT NULL, customer_name NVARCHAR(200) NOT NULL, customer_email NVARCHAR(255) NOT NULL, status NVARCHAR(40) NOT NULL DEFAULT N'New', assigned_agent_id INT NULL, tags NVARCHAR(MAX) NULL, created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(), updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME());
  CREATE INDEX IX_tickets_user_id ON dbo.tickets(user_id, updated_at DESC);
END;
IF OBJECT_ID(N'dbo.ticket_messages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ticket_messages (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, ticket_id INT NOT NULL, sender_id INT NULL, sender_type NVARCHAR(20) NOT NULL, visibility NVARCHAR(20) NOT NULL DEFAULT N'public', content_html NVARCHAR(MAX) NOT NULL, content_text NVARCHAR(MAX) NOT NULL, attachments NVARCHAR(MAX) NULL, created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME());
  CREATE INDEX IX_ticket_messages_ticket_id ON dbo.ticket_messages(ticket_id, created_at);
END;
IF OBJECT_ID(N'dbo.ticket_events', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ticket_events (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, ticket_id INT NOT NULL, actor_id INT NULL, action NVARCHAR(80) NOT NULL, old_value NVARCHAR(MAX) NULL, new_value NVARCHAR(MAX) NULL, created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME());
  CREATE INDEX IX_ticket_events_ticket_id ON dbo.ticket_events(ticket_id, created_at);
END;
