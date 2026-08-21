-- Creates the coupon table used by the dashboard and checkout.
SET NOCOUNT ON;

IF OBJECT_ID('dbo.Coupons', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Coupons (
        CouponId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Coupons PRIMARY KEY,
        Code NVARCHAR(64) NOT NULL,
        DiscountPercent DECIMAL(5,2) NOT NULL,
        ExpiresAt DATETIME2(3) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Coupons_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Coupons_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NULL,
        CONSTRAINT UQ_Coupons_Code UNIQUE (Code),
        CONSTRAINT CK_Coupons_DiscountPercent CHECK (DiscountPercent > 0 AND DiscountPercent <= 100)
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Coupons WHERE Code = N'WELCOME10')
BEGIN
    INSERT INTO dbo.Coupons (Code, DiscountPercent, ExpiresAt, IsActive)
    VALUES (N'WELCOME10', 10, DATEADD(year, 100, SYSUTCDATETIME()), 1);
END;

PRINT 'dbo.Coupons is ready';
