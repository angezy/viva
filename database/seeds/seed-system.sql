/* Production-safe system seed. No customers, staff, orders, payments, or
   store business data belongs in this file. Run after migrations 001-021. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Legacy-compatible structural tables are required by existing dashboard and
-- storefront routes. They are empty on a fresh install by design.
IF OBJECT_ID(N'[dbo].[Notifications]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[Notifications] (
    [NotificationId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Notifications] PRIMARY KEY,
    [Title] NVARCHAR(200) NOT NULL,
    [Message] NVARCHAR(MAX) NOT NULL,
    [CreatedAt] DATETIME NOT NULL CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT GETDATE(),
    [IsRead] BIT NOT NULL CONSTRAINT [DF_Notifications_IsRead] DEFAULT (0),
    [IsVisible] BIT NOT NULL CONSTRAINT [DF_Notifications_IsVisible] DEFAULT (1)
  );
  CREATE INDEX [IX_Notifications_CreatedAt] ON [dbo].[Notifications] ([CreatedAt]);
END;

IF OBJECT_ID(N'[dbo].[DashboardSettings]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[DashboardSettings] (
    [SettingId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DashboardSettings] PRIMARY KEY,
    [SettingKey] NVARCHAR(100) NOT NULL,
    [SettingValue] NVARCHAR(MAX) NULL,
    CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE ([SettingKey])
  );
END;

IF OBJECT_ID(N'[dbo].[HomeContent_tbl]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[HomeContent_tbl] (
    [HomeContentId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY,
    [Title] NVARCHAR(200) NOT NULL,
    [Subtitle] NVARCHAR(MAX) NULL,
    [ImageUrl] NVARCHAR(500) NULL,
    [ButtonText] NVARCHAR(100) NULL,
    [ButtonUrl] NVARCHAR(255) NULL,
    [CreatedAt] DATETIME NOT NULL CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT GETDATE()
  );
END;

IF OBJECT_ID(N'[dbo].[DashboardSettings]', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM [dbo].[DashboardSettings] WHERE [SettingKey] = N'emailNotifications')
    INSERT INTO [dbo].[DashboardSettings] ([SettingKey], [SettingValue]) VALUES (N'emailNotifications', N'true');
  IF NOT EXISTS (SELECT 1 FROM [dbo].[DashboardSettings] WHERE [SettingKey] = N'darkMode')
    INSERT INTO [dbo].[DashboardSettings] ([SettingKey], [SettingValue]) VALUES (N'darkMode', N'false');
END;

PRINT 'System seed completed. No business or customer data was inserted.';
