/*
  Weluxo security completion schema.
  Apply with a deployment-only migration principal after migrations 001-010.
  The web application must not receive DDL permissions.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'Security') IS NULL EXEC(N'CREATE SCHEMA [Security] AUTHORIZATION [dbo]');
IF SCHEMA_ID(N'Integration') IS NULL EXEC(N'CREATE SCHEMA [Integration] AUTHORIZATION [dbo]');
IF SCHEMA_ID(N'Commerce') IS NULL EXEC(N'CREATE SCHEMA [Commerce] AUTHORIZATION [dbo]');

IF OBJECT_ID(N'[Security].[AuthSessions]', N'U') IS NULL
BEGIN
  CREATE TABLE [Security].[AuthSessions] (
    [jti] UNIQUEIDENTIFIER NOT NULL,
    [user_id] INT NOT NULL,
    [session_role] NVARCHAR(20) NOT NULL,
    [email] NVARCHAR(255) NULL,
    [token_hash] CHAR(64) NOT NULL,
    [ip_hash] CHAR(64) NULL,
    [user_agent_hash] CHAR(64) NULL,
    [issued_at] DATETIME2(3) NOT NULL,
    [expires_at] DATETIME2(3) NOT NULL,
    [last_seen_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_AuthSessions_LastSeen] DEFAULT SYSUTCDATETIME(),
    [revoked_at] DATETIME2(3) NULL,
    [revocation_reason] NVARCHAR(120) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_AuthSessions_Created] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_AuthSessions] PRIMARY KEY CLUSTERED ([jti]),
    CONSTRAINT [CK_AuthSessions_Role] CHECK ([session_role] IN (N'user', N'admin')),
    CONSTRAINT [CK_AuthSessions_Expiry] CHECK ([expires_at] > [issued_at])
  );
  CREATE INDEX [IX_AuthSessions_UserActive]
    ON [Security].[AuthSessions] ([user_id], [session_role], [expires_at])
    INCLUDE ([revoked_at]);
END;

IF OBJECT_ID(N'[Commerce].[DurableCartStates]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[DurableCartStates] (
    [owner_key] NVARCHAR(128) NOT NULL,
    [cart_json] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_DurableCart_Cart] DEFAULT N'[]',
    [coupon_json] NVARCHAR(MAX) NULL,
    [saved_guest_json] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_DurableCart_Saved] DEFAULT N'[]',
    [version] BIGINT NOT NULL CONSTRAINT [DF_DurableCart_Version] DEFAULT (1),
    [expires_at] DATETIME2(3) NOT NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_DurableCart_Created] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_DurableCart_Updated] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_DurableCartStates] PRIMARY KEY CLUSTERED ([owner_key]),
    CONSTRAINT [CK_DurableCart_CartJson] CHECK (ISJSON([cart_json]) = 1),
    CONSTRAINT [CK_DurableCart_CouponJson] CHECK ([coupon_json] IS NULL OR ISJSON([coupon_json]) = 1),
    CONSTRAINT [CK_DurableCart_SavedJson] CHECK (ISJSON([saved_guest_json]) = 1)
  );
  CREATE INDEX [IX_DurableCartStates_Expiry] ON [Commerce].[DurableCartStates] ([expires_at]);
END;

IF OBJECT_ID(N'[Security].[UploadObjects]', N'U') IS NULL
BEGIN
  CREATE TABLE [Security].[UploadObjects] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_UploadObjects_Id] DEFAULT NEWSEQUENTIALID(),
    [ticket_id] INT NULL,
    [owner_user_id] INT NULL,
    [storage_name] NVARCHAR(255) NOT NULL,
    [original_name] NVARCHAR(255) NULL,
    [media_type] NVARCHAR(160) NOT NULL,
    [size_bytes] BIGINT NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [scan_status] NVARCHAR(30) NOT NULL,
    [scanner] NVARCHAR(80) NULL,
    [scan_detail] NVARCHAR(400) NULL,
    [legacy_public_path] NVARCHAR(500) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_UploadObjects_Created] DEFAULT SYSUTCDATETIME(),
    [scanned_at] DATETIME2(3) NULL,
    [released_at] DATETIME2(3) NULL,
    [deleted_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_UploadObjects] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_UploadObjects_StorageName] UNIQUE ([storage_name]),
    CONSTRAINT [CK_UploadObjects_Status] CHECK ([scan_status] IN (N'Quarantined', N'Clean', N'Infected', N'Error', N'Migrated')),
    CONSTRAINT [CK_UploadObjects_Size] CHECK ([size_bytes] >= 0)
  );
  CREATE INDEX [IX_UploadObjects_Ticket] ON [Security].[UploadObjects] ([ticket_id], [scan_status]);
  CREATE UNIQUE INDEX [UX_UploadObjects_LegacyPath] ON [Security].[UploadObjects] ([legacy_public_path]) WHERE [legacy_public_path] IS NOT NULL;
END;

IF OBJECT_ID(N'[Integration].[SecurityEvents]', N'U') IS NULL
BEGIN
  CREATE TABLE [Integration].[SecurityEvents] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [event_type] NVARCHAR(100) NOT NULL,
    [severity] NVARCHAR(20) NOT NULL,
    [actor_hash] CHAR(64) NULL,
    [resource_type] NVARCHAR(80) NULL,
    [resource_id_hash] CHAR(64) NULL,
    [request_id] UNIQUEIDENTIFIER NULL,
    [metadata_json] NVARCHAR(2000) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_SecurityEvents_Created] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_SecurityEvents] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_SecurityEvents_Severity] CHECK ([severity] IN (N'info', N'warning', N'high', N'critical')),
    CONSTRAINT [CK_SecurityEvents_Metadata] CHECK ([metadata_json] IS NULL OR ISJSON([metadata_json]) = 1)
  );
  CREATE INDEX [IX_SecurityEvents_TypeTime] ON [Integration].[SecurityEvents] ([event_type], [created_at] DESC);
  CREATE INDEX [IX_SecurityEvents_SeverityTime] ON [Integration].[SecurityEvents] ([severity], [created_at] DESC);
END;

IF OBJECT_ID(N'[Commerce].[InventoryAdjustments]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[InventoryAdjustments] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_InventoryAdjustments_Id] DEFAULT NEWSEQUENTIALID(),
    [checkout_id] UNIQUEIDENTIFIER NOT NULL,
    [provider_event_id] NVARCHAR(255) NULL,
    [decision] NVARCHAR(30) NOT NULL,
    [is_final] BIT NOT NULL CONSTRAINT [DF_InventoryAdjustments_Final] DEFAULT (0),
    [reason] NVARCHAR(400) NULL,
    [actor_user_id] INT NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_InventoryAdjustments_Created] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_InventoryAdjustments] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_InventoryAdjustments_Checkout] FOREIGN KEY ([checkout_id]) REFERENCES [Commerce].[SecureCheckoutSessions]([id]),
    CONSTRAINT [CK_InventoryAdjustments_Decision] CHECK ([decision] IN (N'ReviewRequired', N'Restocked', N'NoRestock')),
    CONSTRAINT [CK_InventoryAdjustments_Final] CHECK (([is_final] = 0 AND [decision] = N'ReviewRequired') OR ([is_final] = 1 AND [decision] IN (N'Restocked', N'NoRestock')))
  );
  CREATE UNIQUE INDEX [UX_InventoryAdjustments_ProviderEvent] ON [Commerce].[InventoryAdjustments] ([provider_event_id]) WHERE [provider_event_id] IS NOT NULL;
  CREATE UNIQUE INDEX [UX_InventoryAdjustments_FinalDecision] ON [Commerce].[InventoryAdjustments] ([checkout_id]) WHERE [is_final] = 1;
END;

IF COL_LENGTH(N'Commerce.SecureCheckoutSessions', N'refund_inventory_status') IS NULL
  ALTER TABLE [Commerce].[SecureCheckoutSessions] ADD [refund_inventory_status] NVARCHAR(30) NULL;
IF COL_LENGTH(N'Commerce.SecureCheckoutSessions', N'provider_payment_id') IS NULL
  ALTER TABLE [Commerce].[SecureCheckoutSessions] ADD [provider_payment_id] NVARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_SecureCheckoutSessions_Payment' AND [object_id] = OBJECT_ID(N'[Commerce].[SecureCheckoutSessions]'))
  EXEC(N'CREATE INDEX [IX_SecureCheckoutSessions_Payment] ON [Commerce].[SecureCheckoutSessions] ([provider_payment_id]) WHERE [provider_payment_id] IS NOT NULL;');

IF OBJECT_ID(N'[Commerce].[InventoryReservations]', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_InventoryReservations_status' AND [parent_object_id] = OBJECT_ID(N'[Commerce].[InventoryReservations]'))
    ALTER TABLE [Commerce].[InventoryReservations] DROP CONSTRAINT [CK_InventoryReservations_status];
  ALTER TABLE [Commerce].[InventoryReservations] WITH CHECK ADD CONSTRAINT [CK_InventoryReservations_status]
    CHECK ([reservation_status] IN (N'Active', N'Consumed', N'Released', N'Expired', N'Restocked'));
END;

/* Compatibility storage used by the storefront. These names cannot collide
   with migration 001's legacy compatibility views. */
IF OBJECT_ID(N'[Commerce].[StorefrontProductImages]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[StorefrontProductImages] (
    [ImageId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ProductId] INT NOT NULL,
    [ImagePath] NVARCHAR(500) NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX [IX_StorefrontProductImages_Product] ON [Commerce].[StorefrontProductImages] ([ProductId]);
END;
IF OBJECT_ID(N'[dbo].[ProductImages_tbl]', N'U') IS NOT NULL
  EXEC(N'
    INSERT INTO [Commerce].[StorefrontProductImages] ([ProductId], [ImagePath], [CreatedAt])
    SELECT legacy.[ProductId], legacy.[ImagePath], SYSUTCDATETIME()
    FROM [dbo].[ProductImages_tbl] legacy
    WHERE NOT EXISTS (
      SELECT 1 FROM [Commerce].[StorefrontProductImages] currentRow
      WHERE currentRow.[ProductId] = legacy.[ProductId] AND currentRow.[ImagePath] = legacy.[ImagePath]
    );
  ');

IF OBJECT_ID(N'[Commerce].[StorefrontProductAddresses]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[StorefrontProductAddresses] (
    [AddressId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ProductId] INT NOT NULL UNIQUE,
    [AddressLine] NVARCHAR(255) NOT NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
IF OBJECT_ID(N'[dbo].[ProductAddress_tbl]', N'U') IS NOT NULL
  EXEC(N'
    MERGE [Commerce].[StorefrontProductAddresses] AS target
    USING (SELECT [ProductId], [AddressLine] FROM [dbo].[ProductAddress_tbl]) AS source
      ON target.[ProductId] = source.[ProductId]
    WHEN MATCHED THEN UPDATE SET [AddressLine] = source.[AddressLine]
    WHEN NOT MATCHED THEN INSERT ([ProductId], [AddressLine], [CreatedAt])
      VALUES (source.[ProductId], source.[AddressLine], SYSUTCDATETIME());
  ');

IF OBJECT_ID(N'[Commerce].[StorefrontOrders]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[StorefrontOrders] (
    [OrderId] NVARCHAR(64) NOT NULL,
    [UserId] NVARCHAR(64) NOT NULL,
    [Status] NVARCHAR(50) NOT NULL,
    [Total] DECIMAL(18,2) NOT NULL,
    [Items] NVARCHAR(MAX) NOT NULL,
    [ShippingAddress] NVARCHAR(MAX) NULL,
    [PaymentMethod] NVARCHAR(30) NULL,
    [PaymentStatus] NVARCHAR(30) NULL,
    [CouponCode] NVARCHAR(64) NULL,
    [Carrier] NVARCHAR(80) NULL,
    [TrackingNumber] NVARCHAR(120) NULL,
    [EstimatedDelivery] DATE NULL,
    [CurrentLocation] NVARCHAR(160) NULL,
    [ShippedAt] DATETIME2(3) NULL,
    [DeliveredAt] DATETIME2(3) NULL,
    [PlacedAt] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_StorefrontOrders] PRIMARY KEY CLUSTERED ([OrderId], [UserId]),
    CONSTRAINT [CK_StorefrontOrders_Items] CHECK (ISJSON([Items]) = 1),
    CONSTRAINT [CK_StorefrontOrders_Shipping] CHECK ([ShippingAddress] IS NULL OR ISJSON([ShippingAddress]) = 1),
    CONSTRAINT [CK_StorefrontOrders_Total] CHECK ([Total] >= 0)
  );
  CREATE INDEX [IX_StorefrontOrders_UserPlaced] ON [Commerce].[StorefrontOrders] ([UserId], [PlacedAt] DESC);
END;

IF OBJECT_ID(N'[Commerce].[StorefrontOrderTrackingEvents]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[StorefrontOrderTrackingEvents] (
    [TrackingEventId] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [OrderId] NVARCHAR(64) NOT NULL,
    [UserId] NVARCHAR(64) NOT NULL,
    [Status] NVARCHAR(50) NOT NULL,
    [Title] NVARCHAR(160) NOT NULL,
    [Description] NVARCHAR(600) NULL,
    [Location] NVARCHAR(160) NULL,
    [EventAt] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    [IsPublic] BIT NOT NULL DEFAULT (1)
  );
  CREATE INDEX [IX_StorefrontTracking_Order] ON [Commerce].[StorefrontOrderTrackingEvents] ([OrderId], [UserId], [EventAt] DESC);
END;

IF OBJECT_ID(N'[Commerce].[StorefrontCheckoutAttempts]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[StorefrontCheckoutAttempts] (
    [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [attempt_id] NVARCHAR(120) NOT NULL UNIQUE,
    [user_id] NVARCHAR(128) NULL,
    [cart_id] NVARCHAR(128) NULL,
    [customer_email] NVARCHAR(255) NULL,
    [status] NVARCHAR(40) NOT NULL,
    [payment_error] NVARCHAR(1000) NULL,
    [payment_id] NVARCHAR(120) NULL,
    [created_at] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NULL,
    [completed_at] DATETIME2(3) NULL
  );
  CREATE INDEX [IX_StorefrontCheckoutAttempts_User] ON [Commerce].[StorefrontCheckoutAttempts] ([user_id], [created_at] DESC);
END;

IF OBJECT_ID(N'[Integration].[CjImportMappings]', N'U') IS NULL
BEGIN
  CREATE TABLE [Integration].[CjImportMappings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Pid] NVARCHAR(120) NOT NULL UNIQUE,
    [ProductId] INT NOT NULL UNIQUE,
    [Price] DECIMAL(18,2) NOT NULL,
    [RawJson] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [CK_CjImportMappings_Raw] CHECK ([RawJson] IS NULL OR ISJSON([RawJson]) = 1)
  );
  CREATE INDEX [IX_CjImportMappings_Product] ON [Integration].[CjImportMappings] ([ProductId]);
END;

/* Product widening is migration-only and is skipped when Products_tbl is the
   canonical compatibility view created by migration 001. */
IF OBJECT_ID(N'[dbo].[Products_tbl]', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Products_tbl]') AND name = N'Name' AND max_length > 0 AND max_length < 510)
    ALTER TABLE [dbo].[Products_tbl] ALTER COLUMN [Name] NVARCHAR(255) NULL;
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Products_tbl]') AND name = N'Brand' AND max_length > 0 AND max_length < 200)
    ALTER TABLE [dbo].[Products_tbl] ALTER COLUMN [Brand] NVARCHAR(100) NULL;
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Products_tbl]') AND name = N'Category' AND max_length > 0 AND max_length < 200)
    ALTER TABLE [dbo].[Products_tbl] ALTER COLUMN [Category] NVARCHAR(100) NULL;
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Products_tbl]') AND name = N'Description' AND max_length <> -1)
    ALTER TABLE [dbo].[Products_tbl] ALTER COLUMN [Description] NVARCHAR(MAX) NULL;
END;

IF OBJECT_ID(N'[dbo].[WeluxoMigrationHistory]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM [dbo].[WeluxoMigrationHistory] WHERE [MigrationId] = N'011_security_completion')
  INSERT INTO [dbo].[WeluxoMigrationHistory] ([MigrationId], [Description])
  VALUES (N'011_security_completion', N'Revocable sessions, durable carts, quarantine, telemetry, refund decisions, and migration-only storefront compatibility schema.');
