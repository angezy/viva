-- create_orders_tbl.sql
-- Creates the Orders table used by the dashboard API
SET NOCOUNT ON;

IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL
BEGIN
    PRINT 'Dropping existing dbo.Orders';
    DROP TABLE dbo.Orders;
END

CREATE TABLE dbo.Orders (
    OrderId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    OrderNumber NVARCHAR(50) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    TotalAmount DECIMAL(18,2) NOT NULL DEFAULT(0),
    Status NVARCHAR(50) NOT NULL DEFAULT('pending')
);

-- Optional foreign key: only add if User_tbl exists
IF OBJECT_ID('dbo.User_tbl', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Orders_User')
    BEGIN
        ALTER TABLE dbo.Orders
        ADD CONSTRAINT FK_Orders_User FOREIGN KEY (UserId) REFERENCES dbo.User_tbl(UserID);
    END
END

CREATE INDEX IX_Orders_CreatedAt ON dbo.Orders (CreatedAt);

PRINT 'dbo.Orders created';
