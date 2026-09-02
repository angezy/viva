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

IF OBJECT_ID('dbo.CouponRedemptions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CouponRedemptions (
        RedemptionId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CouponRedemptions PRIMARY KEY,
        CouponId INT NOT NULL,
        CustomerKey NVARCHAR(255) NOT NULL,
        CustomerEmail NVARCHAR(255) NULL,
        OrderId NVARCHAR(64) NULL,
        RedeemedAt DATETIME2(3) NOT NULL CONSTRAINT DF_CouponRedemptions_RedeemedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_CouponRedemptions_Coupon FOREIGN KEY (CouponId) REFERENCES dbo.Coupons(CouponId),
        CONSTRAINT UQ_CouponRedemptions_CouponCustomer UNIQUE (CouponId, CustomerKey)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_CouponRedemptions_CouponEmail'
      AND object_id = OBJECT_ID(N'dbo.CouponRedemptions')
)
    CREATE UNIQUE INDEX UX_CouponRedemptions_CouponEmail
        ON dbo.CouponRedemptions(CouponId, CustomerEmail)
        WHERE CustomerEmail IS NOT NULL;

PRINT 'dbo.Coupons is ready';
