-- Database schema reconstruction generated from SQL Server metadata.
-- Contains only CREATE TABLE, ALTER TABLE ... ADD CONSTRAINT, and CREATE INDEX statements plus comments.
-- Execute each database section in its corresponding database. Schemas are assumed to already exist.

-- DATABASE: 24033_nhb

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: 24033_NWP

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: chesterniku

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: master

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: model

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: Momeni

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: msdb

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: paristanick_cashbuyers

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: tempdb

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: viva

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);

-- DATABASE: weluxo

CREATE TABLE [dbo].[DashboardSettings] (
  [SettingId] int IDENTITY(1,1) NOT NULL,
  [SettingKey] nvarchar(100) NOT NULL,
  [SettingValue] nvarchar(MAX) NULL
);

CREATE TABLE [dbo].[HomeContent_tbl] (
  [HomeContentId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Subtitle] nvarchar(MAX) NULL,
  [ImageUrl] nvarchar(500) NULL,
  [ButtonText] nvarchar(100) NULL,
  [ButtonUrl] nvarchar(255) NULL,
  [CreatedAt] datetime NOT NULL
);

CREATE TABLE [dbo].[Notifications] (
  [NotificationId] int IDENTITY(1,1) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Message] nvarchar(MAX) NOT NULL,
  [CreatedAt] datetime NOT NULL,
  [IsRead] bit NOT NULL,
  [IsVisible] bit NOT NULL
);

ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [DF_HomeContent_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (getdate()) FOR [CreatedAt];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)) FOR [IsRead];
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [DF_Notifications_IsVisible] DEFAULT ((1)) FOR [IsVisible];
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [PK_DashboardSettings] PRIMARY KEY CLUSTERED ([SettingId]);
ALTER TABLE [dbo].[HomeContent_tbl] ADD CONSTRAINT [PK_HomeContent_tbl] PRIMARY KEY CLUSTERED ([HomeContentId]);
ALTER TABLE [dbo].[Notifications] ADD CONSTRAINT [PK_Notifications] PRIMARY KEY CLUSTERED ([NotificationId]);
ALTER TABLE [dbo].[DashboardSettings] ADD CONSTRAINT [UQ_DashboardSettings_SettingKey] UNIQUE NONCLUSTERED ([SettingKey]);
