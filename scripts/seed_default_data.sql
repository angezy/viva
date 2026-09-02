/*
  Backwards-compatible entrypoint for older deployments.
  Production-safe seed only: the former Weluxo demo catalog, notification,
  review, and known-password administrator fixtures were intentionally removed.
  Prefer database/seeds/seed-system.sql in new installations.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'[dbo].[DashboardSettings]', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM [dbo].[DashboardSettings] WHERE [SettingKey] = N'emailNotifications')
    INSERT INTO [dbo].[DashboardSettings] ([SettingKey], [SettingValue]) VALUES (N'emailNotifications', N'true');
  IF NOT EXISTS (SELECT 1 FROM [dbo].[DashboardSettings] WHERE [SettingKey] = N'darkMode')
    INSERT INTO [dbo].[DashboardSettings] ([SettingKey], [SettingValue]) VALUES (N'darkMode', N'false');
END;

PRINT 'Legacy seed entrypoint completed with system defaults only.';
