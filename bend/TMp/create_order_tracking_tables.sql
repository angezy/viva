-- Tracking columns are added idempotently by homeroute.js when the order API is used.
-- This table stores public carrier events for the customer tracking timeline.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.OrderTrackingEvents_tbl', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OrderTrackingEvents_tbl (
        TrackingEventId BIGINT IDENTITY(1,1) PRIMARY KEY,
        OrderId NVARCHAR(64) NOT NULL,
        UserId NVARCHAR(64) NOT NULL,
        Status NVARCHAR(50) NOT NULL,
        Title NVARCHAR(160) NOT NULL,
        Description NVARCHAR(600) NULL,
        Location NVARCHAR(160) NULL,
        EventAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        IsPublic BIT NOT NULL DEFAULT 1
    );

    CREATE INDEX IX_OrderTrackingEvents_Order
        ON dbo.OrderTrackingEvents_tbl(OrderId, UserId, EventAt DESC);
END;
