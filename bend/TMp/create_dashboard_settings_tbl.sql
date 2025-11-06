-- create_dashboard_settings_tbl.sql
-- Creates the DashboardSettings table used to persist dashboard preferences
SET NOCOUNT ON;

IF OBJECT_ID('dbo.DashboardSettings', 'U') IS NOT NULL
BEGIN
    PRINT 'Dropping existing dbo.DashboardSettings';
    DROP TABLE dbo.DashboardSettings;
END

CREATE TABLE dbo.DashboardSettings (
    SettingKey NVARCHAR(100) PRIMARY KEY,
    SettingValue NVARCHAR(MAX) NULL
);

PRINT 'dbo.DashboardSettings created';
