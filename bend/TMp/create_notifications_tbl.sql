-- create_notifications_tbl.sql
-- Creates the Notifications table used by the dashboard API
SET NOCOUNT ON;

IF OBJECT_ID('dbo.Notifications', 'U') IS NOT NULL
BEGIN
    PRINT 'Dropping existing dbo.Notifications';
    DROP TABLE dbo.Notifications;
END

CREATE TABLE dbo.Notifications (
    NotificationId INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(200) NULL,
    Message NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsRead BIT NOT NULL DEFAULT(0),
    IsVisible BIT NOT NULL DEFAULT(1)
);

CREATE INDEX IX_Notifications_CreatedAt ON dbo.Notifications (CreatedAt);

PRINT 'dbo.Notifications created';
