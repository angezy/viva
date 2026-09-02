/* Durable linkage between a storefront order and the supplier order created
   after customer payment is confirmed. Customer address data is sent directly to
   CJ and is intentionally not copied into this integration table. */
IF OBJECT_ID(N'[Commerce].[CjFulfillmentOrders]', N'U') IS NULL
BEGIN
  CREATE TABLE [Commerce].[CjFulfillmentOrders] (
    [OrderId] NVARCHAR(64) NOT NULL,
    [UserId] NVARCHAR(64) NOT NULL,
    [CjOrderId] NVARCHAR(200) NULL,
    [CjOrderCode] NVARCHAR(200) NULL,
    [CjStatus] NVARCHAR(50) NULL,
    [CjTrackingNumber] NVARCHAR(200) NULL,
    [CjCarrier] NVARCHAR(200) NULL,
    [SubmissionStatus] NVARCHAR(30) NOT NULL CONSTRAINT [DF_CjFulfillmentOrders_SubmissionStatus] DEFAULT N'Pending',
    [LastError] NVARCHAR(600) NULL,
    [SubmittedAt] DATETIME2(3) NULL,
    [LastSyncedAt] DATETIME2(3) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CjFulfillmentOrders_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CjFulfillmentOrders_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_CjFulfillmentOrders] PRIMARY KEY CLUSTERED ([OrderId], [UserId])
  );
  CREATE INDEX [IX_CjFulfillmentOrders_CjOrderId] ON [Commerce].[CjFulfillmentOrders] ([CjOrderId]) WHERE [CjOrderId] IS NOT NULL;
END;
