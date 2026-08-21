/* One successful redemption per coupon and customer. */
SET NOCOUNT ON;

IF OBJECT_ID(N'[dbo].[CouponRedemptions]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[CouponRedemptions] (
    [RedemptionId] BIGINT IDENTITY(1,1) NOT NULL,
    [CouponId] INT NOT NULL,
    [CustomerKey] NVARCHAR(255) NOT NULL,
    [CustomerEmail] NVARCHAR(255) NULL,
    [OrderId] NVARCHAR(64) NULL,
    [RedeemedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CouponRedemptions_RedeemedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_CouponRedemptions] PRIMARY KEY CLUSTERED ([RedemptionId]),
    CONSTRAINT [FK_CouponRedemptions_Coupon] FOREIGN KEY ([CouponId]) REFERENCES [dbo].[Coupons]([CouponId]),
    CONSTRAINT [UQ_CouponRedemptions_CouponCustomer] UNIQUE ([CouponId], [CustomerKey])
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'UX_CouponRedemptions_CouponEmail'
    AND [object_id] = OBJECT_ID(N'[dbo].[CouponRedemptions]')
)
  CREATE UNIQUE INDEX [UX_CouponRedemptions_CouponEmail]
    ON [dbo].[CouponRedemptions]([CouponId], [CustomerEmail])
    WHERE [CustomerEmail] IS NOT NULL;
