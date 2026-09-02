/*
  Weluxo platform upgrade 001
  Additive and idempotent: creates canonical Commerce, ERP, and CRM objects.
  It does not drop, rename, truncate, or delete existing objects or rows.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF SCHEMA_ID(N'Commerce') IS NULL EXEC(N'CREATE SCHEMA [Commerce] AUTHORIZATION [dbo]');
  IF SCHEMA_ID(N'ERP') IS NULL EXEC(N'CREATE SCHEMA [ERP] AUTHORIZATION [dbo]');
  IF SCHEMA_ID(N'CRM') IS NULL EXEC(N'CREATE SCHEMA [CRM] AUTHORIZATION [dbo]');

  IF OBJECT_ID(N'[dbo].[WeluxoMigrationHistory]', N'U') IS NULL
  BEGIN
    CREATE TABLE [dbo].[WeluxoMigrationHistory] (
      [MigrationId] NVARCHAR(120) NOT NULL CONSTRAINT [PK_WeluxoMigrationHistory] PRIMARY KEY,
      [Description] NVARCHAR(500) NOT NULL,
      [AppliedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_WeluxoMigrationHistory_AppliedAt] DEFAULT SYSUTCDATETIME()
    );
  END;

  /* ================================================================
     COMMERCE: catalog
     ================================================================ */
  IF OBJECT_ID(N'[Commerce].[Products]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[Products] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_Products_Id] DEFAULT NEWSEQUENTIALID(),
      [LegacyProductId] INT IDENTITY(1,1) NOT NULL,
      [SKU] NVARCHAR(100) NOT NULL,
      [Name] NVARCHAR(255) NOT NULL,
      [Slug] NVARCHAR(255) NOT NULL,
      [ShortDescription] NVARCHAR(500) NULL,
      [Description] NVARCHAR(MAX) NULL,
      [Brand] NVARCHAR(100) NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_Commerce_Products_Status] DEFAULT N'Draft',
      [ProductType] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Commerce_Products_ProductType] DEFAULT N'Physical',
      [DefaultVariantId] UNIQUEIDENTIFIER NULL,
      [IsFeatured] BIT NOT NULL CONSTRAINT [DF_Commerce_Products_IsFeatured] DEFAULT (0),
      [IsTrending] BIT NOT NULL CONSTRAINT [DF_Commerce_Products_IsTrending] DEFAULT (0),
      [PublishedAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Products_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Products_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_Products] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_Commerce_Products_LegacyProductId] UNIQUE NONCLUSTERED ([LegacyProductId]),
      CONSTRAINT [UQ_Commerce_Products_SKU] UNIQUE NONCLUSTERED ([SKU]),
      CONSTRAINT [UQ_Commerce_Products_Slug] UNIQUE NONCLUSTERED ([Slug]),
      CONSTRAINT [CK_Commerce_Products_Status] CHECK ([Status] IN (N'Draft', N'Active', N'Archived'))
    );
  END;

  IF OBJECT_ID(N'[Commerce].[ProductVariants]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[ProductVariants] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_Id] DEFAULT NEWSEQUENTIALID(),
      [ProductId] UNIQUEIDENTIFIER NOT NULL,
      [SKU] NVARCHAR(100) NOT NULL,
      [Barcode] NVARCHAR(100) NULL,
      [VariantName] NVARCHAR(255) NOT NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_Status] DEFAULT N'Active',
      [Weight] DECIMAL(19,4) NULL,
      [WeightUnit] NVARCHAR(20) NULL,
      [CostPrice] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_CostPrice] DEFAULT (0),
      [CompareAtPrice] DECIMAL(19,4) NULL,
      [SellingPrice] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_SellingPrice] DEFAULT (0),
      [Currency] CHAR(3) NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_Currency] DEFAULT ('USD'),
      [AvailableQuantity] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_AvailableQuantity] DEFAULT (0),
      [LowStockThreshold] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_LowStockThreshold] DEFAULT (5),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_ProductVariants_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_ProductVariants] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_ProductVariants_Product] FOREIGN KEY ([ProductId]) REFERENCES [Commerce].[Products]([Id]),
      CONSTRAINT [UQ_Commerce_ProductVariants_SKU] UNIQUE NONCLUSTERED ([SKU]),
      CONSTRAINT [CK_Commerce_ProductVariants_Status] CHECK ([Status] IN (N'Draft', N'Active', N'Archived')),
      CONSTRAINT [CK_Commerce_ProductVariants_Prices] CHECK ([CostPrice] >= 0 AND [SellingPrice] >= 0 AND ([CompareAtPrice] IS NULL OR [CompareAtPrice] >= 0)),
      CONSTRAINT [CK_Commerce_ProductVariants_Quantity] CHECK ([AvailableQuantity] >= 0 AND [LowStockThreshold] >= 0)
    );
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Commerce_Products_DefaultVariant')
     AND COL_LENGTH(N'Commerce.Products', N'DefaultVariantId') IS NOT NULL
  BEGIN
    ALTER TABLE [Commerce].[Products] WITH CHECK ADD CONSTRAINT [FK_Commerce_Products_DefaultVariant]
      FOREIGN KEY ([DefaultVariantId]) REFERENCES [Commerce].[ProductVariants]([Id]);
  END;

  IF OBJECT_ID(N'[Commerce].[Categories]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[Categories] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_Categories_Id] DEFAULT NEWSEQUENTIALID(),
      [ParentId] UNIQUEIDENTIFIER NULL,
      [Name] NVARCHAR(200) NOT NULL,
      [Slug] NVARCHAR(255) NOT NULL,
      [Description] NVARCHAR(MAX) NULL,
      [SortOrder] INT NOT NULL CONSTRAINT [DF_Commerce_Categories_SortOrder] DEFAULT (0),
      [IsActive] BIT NOT NULL CONSTRAINT [DF_Commerce_Categories_IsActive] DEFAULT (1),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Categories_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Categories_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_Categories] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_Categories_Parent] FOREIGN KEY ([ParentId]) REFERENCES [Commerce].[Categories]([Id]),
      CONSTRAINT [UQ_Commerce_Categories_Slug] UNIQUE NONCLUSTERED ([Slug])
    );
  END;

  IF OBJECT_ID(N'[Commerce].[ProductCategories]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[ProductCategories] (
      [ProductId] UNIQUEIDENTIFIER NOT NULL,
      [CategoryId] UNIQUEIDENTIFIER NOT NULL,
      [IsPrimary] BIT NOT NULL CONSTRAINT [DF_Commerce_ProductCategories_IsPrimary] DEFAULT (0),
      [SortOrder] INT NOT NULL CONSTRAINT [DF_Commerce_ProductCategories_SortOrder] DEFAULT (0),
      CONSTRAINT [PK_Commerce_ProductCategories] PRIMARY KEY CLUSTERED ([ProductId], [CategoryId]),
      CONSTRAINT [FK_Commerce_ProductCategories_Product] FOREIGN KEY ([ProductId]) REFERENCES [Commerce].[Products]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_Commerce_ProductCategories_Category] FOREIGN KEY ([CategoryId]) REFERENCES [Commerce].[Categories]([Id])
    );
  END;

  IF OBJECT_ID(N'[Commerce].[ProductImages]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[ProductImages] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_ProductImages_Id] DEFAULT NEWSEQUENTIALID(),
      [ProductId] UNIQUEIDENTIFIER NOT NULL,
      [VariantId] UNIQUEIDENTIFIER NULL,
      [Url] NVARCHAR(1000) NOT NULL,
      [AltText] NVARCHAR(500) NOT NULL,
      [Title] NVARCHAR(255) NULL,
      [SortOrder] INT NOT NULL CONSTRAINT [DF_Commerce_ProductImages_SortOrder] DEFAULT (0),
      [IsPrimary] BIT NOT NULL CONSTRAINT [DF_Commerce_ProductImages_IsPrimary] DEFAULT (0),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_ProductImages_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_ProductImages] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_ProductImages_Product] FOREIGN KEY ([ProductId]) REFERENCES [Commerce].[Products]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_Commerce_ProductImages_Variant] FOREIGN KEY ([VariantId]) REFERENCES [Commerce].[ProductVariants]([Id])
    );
  END;

  IF OBJECT_ID(N'[Commerce].[ProductVideos]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[ProductVideos] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_ProductVideos_Id] DEFAULT NEWSEQUENTIALID(),
      [ProductId] UNIQUEIDENTIFIER NOT NULL,
      [VariantId] UNIQUEIDENTIFIER NULL,
      [Url] NVARCHAR(1000) NOT NULL,
      [ThumbnailUrl] NVARCHAR(1000) NULL,
      [Title] NVARCHAR(255) NULL,
      [SortOrder] INT NOT NULL CONSTRAINT [DF_Commerce_ProductVideos_SortOrder] DEFAULT (0),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_ProductVideos_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_ProductVideos] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_ProductVideos_Product] FOREIGN KEY ([ProductId]) REFERENCES [Commerce].[Products]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_Commerce_ProductVideos_Variant] FOREIGN KEY ([VariantId]) REFERENCES [Commerce].[ProductVariants]([Id])
    );
  END;

  IF OBJECT_ID(N'[Commerce].[ProductAttributes]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[ProductAttributes] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_ProductAttributes_Id] DEFAULT NEWSEQUENTIALID(),
      [Name] NVARCHAR(200) NOT NULL,
      [Code] NVARCHAR(100) NOT NULL,
      [DataType] NVARCHAR(30) NOT NULL,
      [IsFilterable] BIT NOT NULL CONSTRAINT [DF_Commerce_ProductAttributes_IsFilterable] DEFAULT (0),
      [IsSearchable] BIT NOT NULL CONSTRAINT [DF_Commerce_ProductAttributes_IsSearchable] DEFAULT (0),
      [IsActive] BIT NOT NULL CONSTRAINT [DF_Commerce_ProductAttributes_IsActive] DEFAULT (1),
      CONSTRAINT [PK_Commerce_ProductAttributes] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_Commerce_ProductAttributes_Code] UNIQUE NONCLUSTERED ([Code]),
      CONSTRAINT [CK_Commerce_ProductAttributes_DataType] CHECK ([DataType] IN (N'Text', N'Number', N'Boolean', N'Date'))
    );
  END;

  IF OBJECT_ID(N'[Commerce].[ProductAttributeValues]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[ProductAttributeValues] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_ProductAttributeValues_Id] DEFAULT NEWSEQUENTIALID(),
      [ProductId] UNIQUEIDENTIFIER NOT NULL,
      [VariantId] UNIQUEIDENTIFIER NULL,
      [AttributeId] UNIQUEIDENTIFIER NOT NULL,
      [ValueText] NVARCHAR(MAX) NULL,
      [ValueNumber] DECIMAL(19,8) NULL,
      [ValueBoolean] BIT NULL,
      [ValueDate] DATETIME2(3) NULL,
      CONSTRAINT [PK_Commerce_ProductAttributeValues] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_ProductAttributeValues_Product] FOREIGN KEY ([ProductId]) REFERENCES [Commerce].[Products]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_Commerce_ProductAttributeValues_Variant] FOREIGN KEY ([VariantId]) REFERENCES [Commerce].[ProductVariants]([Id]),
      CONSTRAINT [FK_Commerce_ProductAttributeValues_Attribute] FOREIGN KEY ([AttributeId]) REFERENCES [Commerce].[ProductAttributes]([Id]),
      CONSTRAINT [CK_Commerce_ProductAttributeValues_OneValue] CHECK (
        (CASE WHEN [ValueText] IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN [ValueNumber] IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN [ValueBoolean] IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN [ValueDate] IS NULL THEN 0 ELSE 1 END) = 1
      )
    );
  END;

  /* ================================================================
     CRM customer identity must exist before Commerce orders.
     Authentication-only columns are internal consumers and are never
     projected by overview/report APIs.
     ================================================================ */
  IF OBJECT_ID(N'[CRM].[Customers]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[Customers] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_Customers_Id] DEFAULT NEWSEQUENTIALID(),
      [LegacyUserId] INT IDENTITY(1,1) NOT NULL,
      [CustomerNumber] NVARCHAR(40) NOT NULL,
      [Username] NVARCHAR(100) NULL,
      [Email] NVARCHAR(255) NOT NULL,
      [Phone] NVARCHAR(40) NULL,
      [FirstName] NVARCHAR(120) NOT NULL CONSTRAINT [DF_CRM_Customers_FirstName] DEFAULT N'',
      [LastName] NVARCHAR(120) NOT NULL CONSTRAINT [DF_CRM_Customers_LastName] DEFAULT N'',
      [FullName] NVARCHAR(250) NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_CRM_Customers_Status] DEFAULT N'Active',
      [CustomerType] NVARCHAR(30) NOT NULL CONSTRAINT [DF_CRM_Customers_CustomerType] DEFAULT N'Retail',
      [Role] NVARCHAR(50) NOT NULL CONSTRAINT [DF_CRM_Customers_Role] DEFAULT N'customer',
      [PreferredLanguage] NVARCHAR(10) NULL,
      [PreferredCurrency] CHAR(3) NULL,
      [MarketingConsent] BIT NOT NULL CONSTRAINT [DF_CRM_Customers_MarketingConsent] DEFAULT (0),
      [EmailVerified] BIT NOT NULL CONSTRAINT [DF_CRM_Customers_EmailVerified] DEFAULT (0),
      [FirstOrderAt] DATETIME2(3) NULL,
      [LastOrderAt] DATETIME2(3) NULL,
      [PasswordHash] NVARCHAR(255) NULL,
      [AvatarUrl] NVARCHAR(1000) NULL,
      [Bio] NVARCHAR(MAX) NULL,
      [Country] NVARCHAR(100) NULL,
      [State] NVARCHAR(100) NULL,
      [City] NVARCHAR(100) NULL,
      [Zip] NVARCHAR(30) NULL,
      [Address] NVARCHAR(500) NULL,
      [SignupIP] NVARCHAR(45) NULL,
      [LastLoginIP] NVARCHAR(45) NULL,
      [LastLoginAt] DATETIME2(3) NULL,
      [IsActive] BIT NOT NULL CONSTRAINT [DF_CRM_Customers_IsActive] DEFAULT (1),
      [DeletedAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_Customers_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_Customers_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_Customers] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_CRM_Customers_LegacyUserId] UNIQUE NONCLUSTERED ([LegacyUserId]),
      CONSTRAINT [UQ_CRM_Customers_CustomerNumber] UNIQUE NONCLUSTERED ([CustomerNumber]),
      CONSTRAINT [UQ_CRM_Customers_Email] UNIQUE NONCLUSTERED ([Email]),
      CONSTRAINT [CK_CRM_Customers_Status] CHECK ([Status] IN (N'Active', N'Inactive', N'Blocked'))
    );
    CREATE UNIQUE INDEX [UX_CRM_Customers_Username] ON [CRM].[Customers]([Username]) WHERE [Username] IS NOT NULL;
  END;

  /* ================================================================
     COMMERCE: orders and checkout
     ================================================================ */
  IF OBJECT_ID(N'[Commerce].[Orders]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[Orders] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_Orders_Id] DEFAULT NEWSEQUENTIALID(),
      [LegacyOrderId] NVARCHAR(64) NULL,
      [OrderNumber] NVARCHAR(50) NOT NULL,
      [CustomerId] UNIQUEIDENTIFIER NULL,
      [Currency] CHAR(3) NOT NULL,
      [OrderStatus] NVARCHAR(40) NOT NULL CONSTRAINT [DF_Commerce_Orders_OrderStatus] DEFAULT N'Pending',
      [PaymentStatus] NVARCHAR(40) NOT NULL CONSTRAINT [DF_Commerce_Orders_PaymentStatus] DEFAULT N'Pending',
      [FulfillmentStatus] NVARCHAR(40) NOT NULL CONSTRAINT [DF_Commerce_Orders_FulfillmentStatus] DEFAULT N'Unfulfilled',
      [SubtotalAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Orders_SubtotalAmount] DEFAULT (0),
      [DiscountAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Orders_DiscountAmount] DEFAULT (0),
      [ShippingAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Orders_ShippingAmount] DEFAULT (0),
      [TaxAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Orders_TaxAmount] DEFAULT (0),
      [RefundedAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Orders_RefundedAmount] DEFAULT (0),
      [TotalAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Orders_TotalAmount] DEFAULT (0),
      [CustomerEmail] NVARCHAR(255) NOT NULL,
      [CustomerPhone] NVARCHAR(40) NULL,
      [BillingAddressId] UNIQUEIDENTIFIER NULL,
      [ShippingAddressId] UNIQUEIDENTIFIER NULL,
      [SalesChannel] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Commerce_Orders_SalesChannel] DEFAULT N'OnlineStore',
      [Source] NVARCHAR(100) NULL,
      [PlacedAt] DATETIME2(3) NULL,
      [PaidAt] DATETIME2(3) NULL,
      [CompletedAt] DATETIME2(3) NULL,
      [CancelledAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Orders_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Orders_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_Orders] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_Commerce_Orders_OrderNumber] UNIQUE NONCLUSTERED ([OrderNumber]),
      CONSTRAINT [FK_Commerce_Orders_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [CK_Commerce_Orders_Amounts] CHECK (
        [SubtotalAmount] >= 0 AND [DiscountAmount] >= 0 AND [ShippingAmount] >= 0 AND
        [TaxAmount] >= 0 AND [RefundedAmount] >= 0 AND [TotalAmount] >= 0
      )
    );
    CREATE UNIQUE INDEX [UX_Commerce_Orders_LegacyOrderId] ON [Commerce].[Orders]([LegacyOrderId]) WHERE [LegacyOrderId] IS NOT NULL;
  END;

  IF OBJECT_ID(N'[Commerce].[OrderItems]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[OrderItems] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_OrderItems_Id] DEFAULT NEWSEQUENTIALID(),
      [OrderId] UNIQUEIDENTIFIER NOT NULL,
      [ProductId] UNIQUEIDENTIFIER NULL,
      [VariantId] UNIQUEIDENTIFIER NULL,
      [SKU] NVARCHAR(100) NOT NULL,
      [ProductName] NVARCHAR(255) NOT NULL,
      [VariantName] NVARCHAR(255) NULL,
      [Quantity] DECIMAL(19,4) NOT NULL,
      [UnitPrice] DECIMAL(19,4) NOT NULL,
      [DiscountAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_OrderItems_DiscountAmount] DEFAULT (0),
      [TaxAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_OrderItems_TaxAmount] DEFAULT (0),
      [TotalAmount] DECIMAL(19,4) NOT NULL,
      [UnitCost] DECIMAL(19,4) NULL,
      [SupplierId] UNIQUEIDENTIFIER NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_OrderItems_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_OrderItems] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_OrderItems_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_Commerce_OrderItems_Product] FOREIGN KEY ([ProductId]) REFERENCES [Commerce].[Products]([Id]),
      CONSTRAINT [FK_Commerce_OrderItems_Variant] FOREIGN KEY ([VariantId]) REFERENCES [Commerce].[ProductVariants]([Id]),
      CONSTRAINT [CK_Commerce_OrderItems_Amounts] CHECK ([Quantity] > 0 AND [UnitPrice] >= 0 AND [DiscountAmount] >= 0 AND [TaxAmount] >= 0 AND [TotalAmount] >= 0)
    );
  END;

  IF OBJECT_ID(N'[Commerce].[OrderStatusHistory]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[OrderStatusHistory] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_OrderStatusHistory_Id] DEFAULT NEWSEQUENTIALID(),
      [OrderId] UNIQUEIDENTIFIER NOT NULL,
      [PreviousStatus] NVARCHAR(40) NULL,
      [NewStatus] NVARCHAR(40) NOT NULL,
      [Reason] NVARCHAR(1000) NULL,
      [ChangedByUserId] UNIQUEIDENTIFIER NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_OrderStatusHistory_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_OrderStatusHistory] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_OrderStatusHistory_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]) ON DELETE CASCADE
    );
  END;

  IF OBJECT_ID(N'[Commerce].[OrderAddresses]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[OrderAddresses] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_OrderAddresses_Id] DEFAULT NEWSEQUENTIALID(),
      [OrderId] UNIQUEIDENTIFIER NOT NULL,
      [AddressType] NVARCHAR(20) NOT NULL,
      [FirstName] NVARCHAR(120) NOT NULL,
      [LastName] NVARCHAR(120) NOT NULL,
      [Company] NVARCHAR(200) NULL,
      [Phone] NVARCHAR(40) NULL,
      [AddressLine1] NVARCHAR(255) NOT NULL,
      [AddressLine2] NVARCHAR(255) NULL,
      [City] NVARCHAR(120) NOT NULL,
      [StateProvince] NVARCHAR(120) NULL,
      [PostalCode] NVARCHAR(30) NOT NULL,
      [CountryCode] CHAR(2) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_OrderAddresses_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_OrderAddresses] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_OrderAddresses_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]) ON DELETE CASCADE,
      CONSTRAINT [UQ_Commerce_OrderAddresses_Type] UNIQUE NONCLUSTERED ([OrderId], [AddressType]),
      CONSTRAINT [CK_Commerce_OrderAddresses_Type] CHECK ([AddressType] IN (N'Billing', N'Shipping'))
    );
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Commerce_Orders_BillingAddress')
  BEGIN
    ALTER TABLE [Commerce].[Orders] WITH CHECK ADD CONSTRAINT [FK_Commerce_Orders_BillingAddress]
      FOREIGN KEY ([BillingAddressId]) REFERENCES [Commerce].[OrderAddresses]([Id]);
  END;
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Commerce_Orders_ShippingAddress')
  BEGIN
    ALTER TABLE [Commerce].[Orders] WITH CHECK ADD CONSTRAINT [FK_Commerce_Orders_ShippingAddress]
      FOREIGN KEY ([ShippingAddressId]) REFERENCES [Commerce].[OrderAddresses]([Id]);
  END;

  IF OBJECT_ID(N'[Commerce].[Carts]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[Carts] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_Carts_Id] DEFAULT NEWSEQUENTIALID(),
      [CustomerId] UNIQUEIDENTIFIER NULL,
      [SessionId] NVARCHAR(128) NULL,
      [Currency] CHAR(3) NOT NULL CONSTRAINT [DF_Commerce_Carts_Currency] DEFAULT ('USD'),
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_Commerce_Carts_Status] DEFAULT N'Active',
      [SubtotalAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Carts_SubtotalAmount] DEFAULT (0),
      [DiscountAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Carts_DiscountAmount] DEFAULT (0),
      [EstimatedTaxAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Carts_EstimatedTaxAmount] DEFAULT (0),
      [EstimatedShippingAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Carts_EstimatedShippingAmount] DEFAULT (0),
      [EstimatedTotalAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Carts_EstimatedTotalAmount] DEFAULT (0),
      [ExpiresAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Carts_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Carts_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_Carts] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_Carts_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [CK_Commerce_Carts_Owner] CHECK ([CustomerId] IS NOT NULL OR [SessionId] IS NOT NULL)
    );
    CREATE UNIQUE INDEX [UX_Commerce_Carts_ActiveCustomer] ON [Commerce].[Carts]([CustomerId]) WHERE [CustomerId] IS NOT NULL AND [Status] = N'Active';
    CREATE UNIQUE INDEX [UX_Commerce_Carts_ActiveSession] ON [Commerce].[Carts]([SessionId]) WHERE [SessionId] IS NOT NULL AND [Status] = N'Active';
  END;

  IF OBJECT_ID(N'[Commerce].[CartItems]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[CartItems] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_CartItems_Id] DEFAULT NEWSEQUENTIALID(),
      [CartId] UNIQUEIDENTIFIER NOT NULL,
      [ProductId] UNIQUEIDENTIFIER NOT NULL,
      [VariantId] UNIQUEIDENTIFIER NOT NULL,
      [Quantity] DECIMAL(19,4) NOT NULL,
      [UnitPrice] DECIMAL(19,4) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_CartItems_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_CartItems_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_CartItems] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_CartItems_Cart] FOREIGN KEY ([CartId]) REFERENCES [Commerce].[Carts]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_Commerce_CartItems_Product] FOREIGN KEY ([ProductId]) REFERENCES [Commerce].[Products]([Id]),
      CONSTRAINT [FK_Commerce_CartItems_Variant] FOREIGN KEY ([VariantId]) REFERENCES [Commerce].[ProductVariants]([Id]),
      CONSTRAINT [UQ_Commerce_CartItems_CartVariant] UNIQUE NONCLUSTERED ([CartId], [VariantId]),
      CONSTRAINT [CK_Commerce_CartItems_Quantity] CHECK ([Quantity] > 0 AND [UnitPrice] >= 0)
    );
  END;

  IF OBJECT_ID(N'[Commerce].[CheckoutAttempts]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[CheckoutAttempts] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_CheckoutAttempts_Id] DEFAULT NEWSEQUENTIALID(),
      [CartId] UNIQUEIDENTIFIER NULL,
      [CustomerId] UNIQUEIDENTIFIER NULL,
      [Email] NVARCHAR(255) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [Amount] DECIMAL(19,4) NOT NULL,
      [CheckoutStatus] NVARCHAR(40) NOT NULL,
      [PaymentProvider] NVARCHAR(50) NULL,
      [PaymentAttemptId] NVARCHAR(255) NULL,
      [FailureCode] NVARCHAR(100) NULL,
      [FailureMessage] NVARCHAR(1000) NULL,
      [IPAddress] NVARCHAR(45) NULL,
      [UserAgent] NVARCHAR(1000) NULL,
      [StartedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_CheckoutAttempts_StartedAt] DEFAULT SYSUTCDATETIME(),
      [CompletedAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_CheckoutAttempts_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_CheckoutAttempts] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_CheckoutAttempts_Cart] FOREIGN KEY ([CartId]) REFERENCES [Commerce].[Carts]([Id]),
      CONSTRAINT [FK_Commerce_CheckoutAttempts_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [CK_Commerce_CheckoutAttempts_Amount] CHECK ([Amount] >= 0)
    );
  END;

  /* ================================================================
     COMMERCE: shipping and supplier network
     ================================================================ */
  IF OBJECT_ID(N'[Commerce].[ShippingMethods]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[ShippingMethods] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_ShippingMethods_Id] DEFAULT NEWSEQUENTIALID(),
      [Code] NVARCHAR(50) NOT NULL,
      [Name] NVARCHAR(200) NOT NULL,
      [Carrier] NVARCHAR(120) NOT NULL,
      [ServiceLevel] NVARCHAR(120) NULL,
      [BasePrice] DECIMAL(19,4) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [EstimatedMinDays] INT NULL,
      [EstimatedMaxDays] INT NULL,
      [IsActive] BIT NOT NULL CONSTRAINT [DF_Commerce_ShippingMethods_IsActive] DEFAULT (1),
      CONSTRAINT [PK_Commerce_ShippingMethods] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_Commerce_ShippingMethods_Code] UNIQUE NONCLUSTERED ([Code]),
      CONSTRAINT [CK_Commerce_ShippingMethods_Price] CHECK ([BasePrice] >= 0)
    );
  END;

  IF OBJECT_ID(N'[Commerce].[Suppliers]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[Suppliers] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_Suppliers_Id] DEFAULT NEWSEQUENTIALID(),
      [Code] NVARCHAR(50) NOT NULL,
      [Name] NVARCHAR(200) NOT NULL,
      [SupplierType] NVARCHAR(50) NOT NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_Commerce_Suppliers_Status] DEFAULT N'Active',
      [Website] NVARCHAR(1000) NULL,
      [Email] NVARCHAR(255) NULL,
      [Phone] NVARCHAR(40) NULL,
      [DefaultCurrency] CHAR(3) NOT NULL,
      [CountryCode] CHAR(2) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Suppliers_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Suppliers_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_Suppliers] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_Commerce_Suppliers_Code] UNIQUE NONCLUSTERED ([Code])
    );
  END;

  IF OBJECT_ID(N'[Commerce].[Shipments]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[Shipments] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_Shipments_Id] DEFAULT NEWSEQUENTIALID(),
      [OrderId] UNIQUEIDENTIFIER NOT NULL,
      [ShipmentNumber] NVARCHAR(50) NOT NULL,
      [SupplierId] UNIQUEIDENTIFIER NULL,
      [Carrier] NVARCHAR(120) NOT NULL,
      [Service] NVARCHAR(120) NULL,
      [TrackingNumber] NVARCHAR(255) NULL,
      [TrackingUrl] NVARCHAR(1000) NULL,
      [Status] NVARCHAR(40) NOT NULL,
      [ShippedAt] DATETIME2(3) NULL,
      [DeliveredAt] DATETIME2(3) NULL,
      [ShippingCost] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_Shipments_ShippingCost] DEFAULT (0),
      [Currency] CHAR(3) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Shipments_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_Shipments_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_Shipments] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_Commerce_Shipments_ShipmentNumber] UNIQUE NONCLUSTERED ([ShipmentNumber]),
      CONSTRAINT [FK_Commerce_Shipments_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [FK_Commerce_Shipments_Supplier] FOREIGN KEY ([SupplierId]) REFERENCES [Commerce].[Suppliers]([Id]),
      CONSTRAINT [CK_Commerce_Shipments_Cost] CHECK ([ShippingCost] >= 0)
    );
    CREATE UNIQUE INDEX [UX_Commerce_Shipments_TrackingNumber] ON [Commerce].[Shipments]([TrackingNumber]) WHERE [TrackingNumber] IS NOT NULL;
  END;

  IF OBJECT_ID(N'[Commerce].[ShipmentItems]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[ShipmentItems] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_ShipmentItems_Id] DEFAULT NEWSEQUENTIALID(),
      [ShipmentId] UNIQUEIDENTIFIER NOT NULL,
      [OrderItemId] UNIQUEIDENTIFIER NOT NULL,
      [Quantity] DECIMAL(19,4) NOT NULL,
      CONSTRAINT [PK_Commerce_ShipmentItems] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_ShipmentItems_Shipment] FOREIGN KEY ([ShipmentId]) REFERENCES [Commerce].[Shipments]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_Commerce_ShipmentItems_OrderItem] FOREIGN KEY ([OrderItemId]) REFERENCES [Commerce].[OrderItems]([Id]),
      CONSTRAINT [UQ_Commerce_ShipmentItems_Item] UNIQUE NONCLUSTERED ([ShipmentId], [OrderItemId]),
      CONSTRAINT [CK_Commerce_ShipmentItems_Quantity] CHECK ([Quantity] > 0)
    );
  END;

  IF OBJECT_ID(N'[Commerce].[TrackingEvents]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[TrackingEvents] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_TrackingEvents_Id] DEFAULT NEWSEQUENTIALID(),
      [ShipmentId] UNIQUEIDENTIFIER NOT NULL,
      [EventCode] NVARCHAR(100) NULL,
      [Status] NVARCHAR(80) NOT NULL,
      [Description] NVARCHAR(1000) NULL,
      [Location] NVARCHAR(255) NULL,
      [EventAt] DATETIME2(3) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_TrackingEvents_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_TrackingEvents] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_TrackingEvents_Shipment] FOREIGN KEY ([ShipmentId]) REFERENCES [Commerce].[Shipments]([Id]) ON DELETE CASCADE
    );
  END;

  IF OBJECT_ID(N'[Commerce].[SupplierProducts]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[SupplierProducts] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_SupplierProducts_Id] DEFAULT NEWSEQUENTIALID(),
      [SupplierId] UNIQUEIDENTIFIER NOT NULL,
      [ProductId] UNIQUEIDENTIFIER NOT NULL,
      [VariantId] UNIQUEIDENTIFIER NULL,
      [ExternalProductId] NVARCHAR(255) NOT NULL,
      [ExternalVariantId] NVARCHAR(255) NULL,
      [SupplierSKU] NVARCHAR(255) NULL,
      [SupplierCost] DECIMAL(19,4) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [AvailableQuantity] DECIMAL(19,4) NULL,
      [LeadTimeDays] INT NULL,
      [SyncStatus] NVARCHAR(40) NOT NULL CONSTRAINT [DF_Commerce_SupplierProducts_SyncStatus] DEFAULT N'Pending',
      [LastSyncedAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_SupplierProducts_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_SupplierProducts_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_SupplierProducts] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_SupplierProducts_Supplier] FOREIGN KEY ([SupplierId]) REFERENCES [Commerce].[Suppliers]([Id]),
      CONSTRAINT [FK_Commerce_SupplierProducts_Product] FOREIGN KEY ([ProductId]) REFERENCES [Commerce].[Products]([Id]),
      CONSTRAINT [FK_Commerce_SupplierProducts_Variant] FOREIGN KEY ([VariantId]) REFERENCES [Commerce].[ProductVariants]([Id]),
      CONSTRAINT [UQ_Commerce_SupplierProducts_External] UNIQUE NONCLUSTERED ([SupplierId], [ExternalProductId], [ExternalVariantId]),
      CONSTRAINT [CK_Commerce_SupplierProducts_Cost] CHECK ([SupplierCost] >= 0 AND ([AvailableQuantity] IS NULL OR [AvailableQuantity] >= 0))
    );
  END;

  IF OBJECT_ID(N'[Commerce].[SupplierOrders]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[SupplierOrders] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_SupplierOrders_Id] DEFAULT NEWSEQUENTIALID(),
      [SupplierId] UNIQUEIDENTIFIER NOT NULL,
      [OrderId] UNIQUEIDENTIFIER NOT NULL,
      [PurchaseOrderNumber] NVARCHAR(50) NOT NULL,
      [ExternalOrderId] NVARCHAR(255) NULL,
      [Status] NVARCHAR(40) NOT NULL,
      [ProductCost] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_SupplierOrders_ProductCost] DEFAULT (0),
      [ShippingCost] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_SupplierOrders_ShippingCost] DEFAULT (0),
      [TotalCost] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_Commerce_SupplierOrders_TotalCost] DEFAULT (0),
      [Currency] CHAR(3) NOT NULL,
      [OrderedAt] DATETIME2(3) NULL,
      [ConfirmedAt] DATETIME2(3) NULL,
      [ShippedAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_SupplierOrders_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_SupplierOrders_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Commerce_SupplierOrders] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_Commerce_SupplierOrders_PurchaseOrderNumber] UNIQUE NONCLUSTERED ([PurchaseOrderNumber]),
      CONSTRAINT [FK_Commerce_SupplierOrders_Supplier] FOREIGN KEY ([SupplierId]) REFERENCES [Commerce].[Suppliers]([Id]),
      CONSTRAINT [FK_Commerce_SupplierOrders_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [CK_Commerce_SupplierOrders_Costs] CHECK ([ProductCost] >= 0 AND [ShippingCost] >= 0 AND [TotalCost] >= 0)
    );
    CREATE UNIQUE INDEX [UX_Commerce_SupplierOrders_External] ON [Commerce].[SupplierOrders]([SupplierId], [ExternalOrderId]) WHERE [ExternalOrderId] IS NOT NULL;
  END;

  IF OBJECT_ID(N'[Commerce].[SupplierOrderItems]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[SupplierOrderItems] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_SupplierOrderItems_Id] DEFAULT NEWSEQUENTIALID(),
      [SupplierOrderId] UNIQUEIDENTIFIER NOT NULL,
      [OrderItemId] UNIQUEIDENTIFIER NOT NULL,
      [SupplierProductId] UNIQUEIDENTIFIER NULL,
      [Quantity] DECIMAL(19,4) NOT NULL,
      [UnitCost] DECIMAL(19,4) NOT NULL,
      [TotalCost] DECIMAL(19,4) NOT NULL,
      CONSTRAINT [PK_Commerce_SupplierOrderItems] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_SupplierOrderItems_Order] FOREIGN KEY ([SupplierOrderId]) REFERENCES [Commerce].[SupplierOrders]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_Commerce_SupplierOrderItems_OrderItem] FOREIGN KEY ([OrderItemId]) REFERENCES [Commerce].[OrderItems]([Id]),
      CONSTRAINT [FK_Commerce_SupplierOrderItems_SupplierProduct] FOREIGN KEY ([SupplierProductId]) REFERENCES [Commerce].[SupplierProducts]([Id]),
      CONSTRAINT [CK_Commerce_SupplierOrderItems_Costs] CHECK ([Quantity] > 0 AND [UnitCost] >= 0 AND [TotalCost] >= 0)
    );
  END;

  IF OBJECT_ID(N'[Commerce].[SupplierSyncLogs]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Commerce].[SupplierSyncLogs] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Commerce_SupplierSyncLogs_Id] DEFAULT NEWSEQUENTIALID(),
      [SupplierId] UNIQUEIDENTIFIER NOT NULL,
      [SyncType] NVARCHAR(50) NOT NULL,
      [Status] NVARCHAR(40) NOT NULL,
      [RecordsProcessed] INT NOT NULL CONSTRAINT [DF_Commerce_SupplierSyncLogs_Processed] DEFAULT (0),
      [RecordsSucceeded] INT NOT NULL CONSTRAINT [DF_Commerce_SupplierSyncLogs_Succeeded] DEFAULT (0),
      [RecordsFailed] INT NOT NULL CONSTRAINT [DF_Commerce_SupplierSyncLogs_Failed] DEFAULT (0),
      [ErrorSummary] NVARCHAR(MAX) NULL,
      [StartedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Commerce_SupplierSyncLogs_StartedAt] DEFAULT SYSUTCDATETIME(),
      [FinishedAt] DATETIME2(3) NULL,
      CONSTRAINT [PK_Commerce_SupplierSyncLogs] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_Commerce_SupplierSyncLogs_Supplier] FOREIGN KEY ([SupplierId]) REFERENCES [Commerce].[Suppliers]([Id]),
      CONSTRAINT [CK_Commerce_SupplierSyncLogs_Counts] CHECK ([RecordsProcessed] >= 0 AND [RecordsSucceeded] >= 0 AND [RecordsFailed] >= 0)
    );
  END;

  /* ================================================================
     ERP: legal entity, periods, accounts, and general ledger
     ================================================================ */
  IF OBJECT_ID(N'[ERP].[Companies]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[Companies] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_Companies_Id] DEFAULT NEWSEQUENTIALID(),
      [Code] NVARCHAR(30) NOT NULL,
      [LegalName] NVARCHAR(255) NOT NULL,
      [DisplayName] NVARCHAR(255) NOT NULL,
      [CountryCode] CHAR(2) NOT NULL,
      [BaseCurrency] CHAR(3) NOT NULL,
      [TaxRegistrationNumber] NVARCHAR(100) NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_ERP_Companies_Status] DEFAULT N'Active',
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Companies_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Companies_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_Companies] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_ERP_Companies_Code] UNIQUE NONCLUSTERED ([Code])
    );
  END;

  IF OBJECT_ID(N'[ERP].[FiscalYears]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[FiscalYears] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_FiscalYears_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [Name] NVARCHAR(100) NOT NULL,
      [StartDate] DATE NOT NULL,
      [EndDate] DATE NOT NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_ERP_FiscalYears_Status] DEFAULT N'Open',
      CONSTRAINT [PK_ERP_FiscalYears] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_FiscalYears_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [UQ_ERP_FiscalYears_CompanyName] UNIQUE NONCLUSTERED ([CompanyId], [Name]),
      CONSTRAINT [CK_ERP_FiscalYears_Dates] CHECK ([StartDate] <= [EndDate])
    );
  END;

  IF OBJECT_ID(N'[ERP].[FiscalPeriods]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[FiscalPeriods] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_FiscalPeriods_Id] DEFAULT NEWSEQUENTIALID(),
      [FiscalYearId] UNIQUEIDENTIFIER NOT NULL,
      [PeriodNumber] INT NOT NULL,
      [Name] NVARCHAR(100) NOT NULL,
      [StartDate] DATE NOT NULL,
      [EndDate] DATE NOT NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_ERP_FiscalPeriods_Status] DEFAULT N'Open',
      [ClosedAt] DATETIME2(3) NULL,
      CONSTRAINT [PK_ERP_FiscalPeriods] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_FiscalPeriods_FiscalYear] FOREIGN KEY ([FiscalYearId]) REFERENCES [ERP].[FiscalYears]([Id]),
      CONSTRAINT [UQ_ERP_FiscalPeriods_Number] UNIQUE NONCLUSTERED ([FiscalYearId], [PeriodNumber]),
      CONSTRAINT [CK_ERP_FiscalPeriods_Dates] CHECK ([StartDate] <= [EndDate])
    );
  END;

  IF OBJECT_ID(N'[ERP].[Accounts]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[Accounts] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_Accounts_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [ParentAccountId] UNIQUEIDENTIFIER NULL,
      [AccountCode] NVARCHAR(50) NOT NULL,
      [AccountName] NVARCHAR(255) NOT NULL,
      [AccountType] NVARCHAR(30) NOT NULL,
      [NormalBalance] NVARCHAR(10) NOT NULL,
      [IsPostingAccount] BIT NOT NULL CONSTRAINT [DF_ERP_Accounts_IsPostingAccount] DEFAULT (1),
      [IsActive] BIT NOT NULL CONSTRAINT [DF_ERP_Accounts_IsActive] DEFAULT (1),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Accounts_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Accounts_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_Accounts] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_Accounts_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_Accounts_Parent] FOREIGN KEY ([ParentAccountId]) REFERENCES [ERP].[Accounts]([Id]),
      CONSTRAINT [UQ_ERP_Accounts_Code] UNIQUE NONCLUSTERED ([CompanyId], [AccountCode]),
      CONSTRAINT [CK_ERP_Accounts_Type] CHECK ([AccountType] IN (N'Asset', N'Liability', N'Equity', N'Revenue', N'Expense')),
      CONSTRAINT [CK_ERP_Accounts_NormalBalance] CHECK ([NormalBalance] IN (N'Debit', N'Credit'))
    );
  END;

  IF OBJECT_ID(N'[ERP].[CostCenters]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[CostCenters] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_CostCenters_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [Code] NVARCHAR(50) NOT NULL,
      [Name] NVARCHAR(200) NOT NULL,
      [ParentId] UNIQUEIDENTIFIER NULL,
      [IsActive] BIT NOT NULL CONSTRAINT [DF_ERP_CostCenters_IsActive] DEFAULT (1),
      CONSTRAINT [PK_ERP_CostCenters] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_CostCenters_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_CostCenters_Parent] FOREIGN KEY ([ParentId]) REFERENCES [ERP].[CostCenters]([Id]),
      CONSTRAINT [UQ_ERP_CostCenters_Code] UNIQUE NONCLUSTERED ([CompanyId], [Code])
    );
  END;

  IF OBJECT_ID(N'[ERP].[JournalEntries]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[JournalEntries] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_JournalEntries_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [FiscalPeriodId] UNIQUEIDENTIFIER NOT NULL,
      [JournalNumber] NVARCHAR(50) NOT NULL,
      [JournalType] NVARCHAR(40) NOT NULL,
      [TransactionDate] DATE NOT NULL,
      [PostingDate] DATE NOT NULL,
      [Description] NVARCHAR(1000) NOT NULL,
      [ReferenceType] NVARCHAR(100) NULL,
      [ReferenceId] UNIQUEIDENTIFIER NULL,
      [Status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ERP_JournalEntries_Status] DEFAULT N'Draft',
      [Currency] CHAR(3) NOT NULL,
      [ExchangeRate] DECIMAL(19,8) NOT NULL CONSTRAINT [DF_ERP_JournalEntries_ExchangeRate] DEFAULT (1),
      [CreatedByUserId] UNIQUEIDENTIFIER NOT NULL,
      [PostedByUserId] UNIQUEIDENTIFIER NULL,
      [ReversalOfJournalEntryId] UNIQUEIDENTIFIER NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_JournalEntries_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [PostedAt] DATETIME2(3) NULL,
      CONSTRAINT [PK_ERP_JournalEntries] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_JournalEntries_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_JournalEntries_Period] FOREIGN KEY ([FiscalPeriodId]) REFERENCES [ERP].[FiscalPeriods]([Id]),
      CONSTRAINT [FK_ERP_JournalEntries_Reversal] FOREIGN KEY ([ReversalOfJournalEntryId]) REFERENCES [ERP].[JournalEntries]([Id]),
      CONSTRAINT [UQ_ERP_JournalEntries_Number] UNIQUE NONCLUSTERED ([CompanyId], [JournalNumber]),
      CONSTRAINT [CK_ERP_JournalEntries_Status] CHECK ([Status] IN (N'Draft', N'Posted', N'Reversed')),
      CONSTRAINT [CK_ERP_JournalEntries_ExchangeRate] CHECK ([ExchangeRate] > 0)
    );
  END;

  IF OBJECT_ID(N'[ERP].[JournalLines]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[JournalLines] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_JournalLines_Id] DEFAULT NEWSEQUENTIALID(),
      [JournalEntryId] UNIQUEIDENTIFIER NOT NULL,
      [AccountId] UNIQUEIDENTIFIER NOT NULL,
      [Description] NVARCHAR(1000) NULL,
      [DebitAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_JournalLines_DebitAmount] DEFAULT (0),
      [CreditAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_JournalLines_CreditAmount] DEFAULT (0),
      [TransactionCurrency] CHAR(3) NOT NULL,
      [TransactionAmount] DECIMAL(19,4) NOT NULL,
      [BaseCurrency] CHAR(3) NOT NULL,
      [BaseAmount] DECIMAL(19,4) NOT NULL,
      [CustomerId] UNIQUEIDENTIFIER NULL,
      [SupplierId] UNIQUEIDENTIFIER NULL,
      [OrderId] UNIQUEIDENTIFIER NULL,
      [CostCenterId] UNIQUEIDENTIFIER NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_JournalLines_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_JournalLines] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_JournalLines_Entry] FOREIGN KEY ([JournalEntryId]) REFERENCES [ERP].[JournalEntries]([Id]),
      CONSTRAINT [FK_ERP_JournalLines_Account] FOREIGN KEY ([AccountId]) REFERENCES [ERP].[Accounts]([Id]),
      CONSTRAINT [FK_ERP_JournalLines_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [FK_ERP_JournalLines_Supplier] FOREIGN KEY ([SupplierId]) REFERENCES [Commerce].[Suppliers]([Id]),
      CONSTRAINT [FK_ERP_JournalLines_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [FK_ERP_JournalLines_CostCenter] FOREIGN KEY ([CostCenterId]) REFERENCES [ERP].[CostCenters]([Id]),
      CONSTRAINT [CK_ERP_JournalLines_DebitCredit] CHECK (
        [DebitAmount] >= 0 AND [CreditAmount] >= 0 AND
        (([DebitAmount] > 0 AND [CreditAmount] = 0) OR ([CreditAmount] > 0 AND [DebitAmount] = 0))
      )
    );
  END;

  /* ================================================================
     ERP: receivables, payables, payments, expenses, tax, banking
     ================================================================ */
  IF OBJECT_ID(N'[ERP].[Invoices]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[Invoices] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_Invoices_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [CustomerId] UNIQUEIDENTIFIER NOT NULL,
      [OrderId] UNIQUEIDENTIFIER NULL,
      [InvoiceNumber] NVARCHAR(50) NOT NULL,
      [IssueDate] DATE NOT NULL,
      [DueDate] DATE NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_ERP_Invoices_Status] DEFAULT N'Draft',
      [Currency] CHAR(3) NOT NULL,
      [SubtotalAmount] DECIMAL(19,4) NOT NULL,
      [DiscountAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_Invoices_DiscountAmount] DEFAULT (0),
      [TaxAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_Invoices_TaxAmount] DEFAULT (0),
      [TotalAmount] DECIMAL(19,4) NOT NULL,
      [PaidAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_Invoices_PaidAmount] DEFAULT (0),
      [BalanceAmount] DECIMAL(19,4) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Invoices_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Invoices_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_Invoices] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_Invoices_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_Invoices_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [FK_ERP_Invoices_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [UQ_ERP_Invoices_Number] UNIQUE NONCLUSTERED ([CompanyId], [InvoiceNumber]),
      CONSTRAINT [CK_ERP_Invoices_Amounts] CHECK ([SubtotalAmount] >= 0 AND [DiscountAmount] >= 0 AND [TaxAmount] >= 0 AND [TotalAmount] >= 0 AND [PaidAmount] >= 0 AND [BalanceAmount] >= 0)
    );
  END;

  IF OBJECT_ID(N'[ERP].[InvoiceItems]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[InvoiceItems] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_InvoiceItems_Id] DEFAULT NEWSEQUENTIALID(),
      [InvoiceId] UNIQUEIDENTIFIER NOT NULL,
      [OrderItemId] UNIQUEIDENTIFIER NULL,
      [Description] NVARCHAR(1000) NOT NULL,
      [Quantity] DECIMAL(19,4) NOT NULL,
      [UnitPrice] DECIMAL(19,4) NOT NULL,
      [TaxAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_InvoiceItems_TaxAmount] DEFAULT (0),
      [TotalAmount] DECIMAL(19,4) NOT NULL,
      CONSTRAINT [PK_ERP_InvoiceItems] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_InvoiceItems_Invoice] FOREIGN KEY ([InvoiceId]) REFERENCES [ERP].[Invoices]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_ERP_InvoiceItems_OrderItem] FOREIGN KEY ([OrderItemId]) REFERENCES [Commerce].[OrderItems]([Id]),
      CONSTRAINT [CK_ERP_InvoiceItems_Amounts] CHECK ([Quantity] > 0 AND [UnitPrice] >= 0 AND [TaxAmount] >= 0 AND [TotalAmount] >= 0)
    );
  END;

  IF OBJECT_ID(N'[ERP].[SupplierBills]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[SupplierBills] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_SupplierBills_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [SupplierId] UNIQUEIDENTIFIER NOT NULL,
      [SupplierOrderId] UNIQUEIDENTIFIER NULL,
      [BillNumber] NVARCHAR(50) NOT NULL,
      [SupplierInvoiceNumber] NVARCHAR(100) NULL,
      [IssueDate] DATE NOT NULL,
      [DueDate] DATE NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_ERP_SupplierBills_Status] DEFAULT N'Draft',
      [Currency] CHAR(3) NOT NULL,
      [SubtotalAmount] DECIMAL(19,4) NOT NULL,
      [TaxAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_SupplierBills_TaxAmount] DEFAULT (0),
      [TotalAmount] DECIMAL(19,4) NOT NULL,
      [PaidAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_SupplierBills_PaidAmount] DEFAULT (0),
      [BalanceAmount] DECIMAL(19,4) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_SupplierBills_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_SupplierBills_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_SupplierBills] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_SupplierBills_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_SupplierBills_Supplier] FOREIGN KEY ([SupplierId]) REFERENCES [Commerce].[Suppliers]([Id]),
      CONSTRAINT [FK_ERP_SupplierBills_SupplierOrder] FOREIGN KEY ([SupplierOrderId]) REFERENCES [Commerce].[SupplierOrders]([Id]),
      CONSTRAINT [UQ_ERP_SupplierBills_Number] UNIQUE NONCLUSTERED ([CompanyId], [BillNumber]),
      CONSTRAINT [CK_ERP_SupplierBills_Amounts] CHECK ([SubtotalAmount] >= 0 AND [TaxAmount] >= 0 AND [TotalAmount] >= 0 AND [PaidAmount] >= 0 AND [BalanceAmount] >= 0)
    );
  END;

  IF OBJECT_ID(N'[ERP].[Payments]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[Payments] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_Payments_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [OrderId] UNIQUEIDENTIFIER NULL,
      [InvoiceId] UNIQUEIDENTIFIER NULL,
      [SupplierBillId] UNIQUEIDENTIFIER NULL,
      [Direction] NVARCHAR(10) NOT NULL,
      [PaymentProvider] NVARCHAR(80) NOT NULL,
      [PaymentMethod] NVARCHAR(80) NOT NULL,
      [ExternalTransactionId] NVARCHAR(255) NULL,
      [Amount] DECIMAL(19,4) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [ExchangeRate] DECIMAL(19,8) NOT NULL CONSTRAINT [DF_ERP_Payments_ExchangeRate] DEFAULT (1),
      [Status] NVARCHAR(40) NOT NULL,
      [ProcessedAt] DATETIME2(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Payments_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_Payments] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_Payments_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_Payments_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [FK_ERP_Payments_Invoice] FOREIGN KEY ([InvoiceId]) REFERENCES [ERP].[Invoices]([Id]),
      CONSTRAINT [FK_ERP_Payments_SupplierBill] FOREIGN KEY ([SupplierBillId]) REFERENCES [ERP].[SupplierBills]([Id]),
      CONSTRAINT [CK_ERP_Payments_Direction] CHECK ([Direction] IN (N'Incoming', N'Outgoing')),
      CONSTRAINT [CK_ERP_Payments_Status] CHECK ([Status] IN (N'Pending', N'Authorized', N'Paid', N'Failed', N'Refunded', N'PartiallyRefunded')),
      CONSTRAINT [CK_ERP_Payments_Amount] CHECK ([Amount] >= 0 AND [ExchangeRate] > 0)
    );
    CREATE UNIQUE INDEX [UX_ERP_Payments_ExternalTransaction] ON [ERP].[Payments]([PaymentProvider], [ExternalTransactionId]) WHERE [ExternalTransactionId] IS NOT NULL;
  END;

  IF OBJECT_ID(N'[ERP].[Refunds]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[Refunds] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_Refunds_Id] DEFAULT NEWSEQUENTIALID(),
      [PaymentId] UNIQUEIDENTIFIER NOT NULL,
      [OrderId] UNIQUEIDENTIFIER NOT NULL,
      [RefundNumber] NVARCHAR(50) NOT NULL,
      [ExternalRefundId] NVARCHAR(255) NULL,
      [Amount] DECIMAL(19,4) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [Reason] NVARCHAR(1000) NULL,
      [Status] NVARCHAR(40) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Refunds_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [ProcessedAt] DATETIME2(3) NULL,
      CONSTRAINT [PK_ERP_Refunds] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_Refunds_Payment] FOREIGN KEY ([PaymentId]) REFERENCES [ERP].[Payments]([Id]),
      CONSTRAINT [FK_ERP_Refunds_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [UQ_ERP_Refunds_Number] UNIQUE NONCLUSTERED ([RefundNumber]),
      CONSTRAINT [CK_ERP_Refunds_Amount] CHECK ([Amount] > 0)
    );
  END;

  IF OBJECT_ID(N'[ERP].[BankAccounts]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[BankAccounts] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_BankAccounts_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [AccountName] NVARCHAR(200) NOT NULL,
      [BankName] NVARCHAR(200) NOT NULL,
      [AccountType] NVARCHAR(50) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [MaskedAccountNumber] NVARCHAR(50) NULL,
      [ExternalAccountReference] NVARCHAR(255) NULL,
      [IsActive] BIT NOT NULL CONSTRAINT [DF_ERP_BankAccounts_IsActive] DEFAULT (1),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_BankAccounts_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_BankAccounts_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_BankAccounts] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_BankAccounts_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id])
    );
  END;

  IF OBJECT_ID(N'[ERP].[BankTransactions]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[BankTransactions] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_BankTransactions_Id] DEFAULT NEWSEQUENTIALID(),
      [BankAccountId] UNIQUEIDENTIFIER NOT NULL,
      [TransactionDate] DATE NOT NULL,
      [ValueDate] DATE NULL,
      [Type] NVARCHAR(40) NOT NULL,
      [Description] NVARCHAR(1000) NULL,
      [Reference] NVARCHAR(255) NULL,
      [Amount] DECIMAL(19,4) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [ReconciliationStatus] NVARCHAR(40) NOT NULL CONSTRAINT [DF_ERP_BankTransactions_ReconciliationStatus] DEFAULT N'Unreconciled',
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_BankTransactions_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_BankTransactions] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_BankTransactions_Account] FOREIGN KEY ([BankAccountId]) REFERENCES [ERP].[BankAccounts]([Id])
    );
  END;

  IF OBJECT_ID(N'[ERP].[ExpenseCategories]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[ExpenseCategories] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_ExpenseCategories_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [ParentId] UNIQUEIDENTIFIER NULL,
      [Name] NVARCHAR(200) NOT NULL,
      [AccountId] UNIQUEIDENTIFIER NOT NULL,
      [IsActive] BIT NOT NULL CONSTRAINT [DF_ERP_ExpenseCategories_IsActive] DEFAULT (1),
      CONSTRAINT [PK_ERP_ExpenseCategories] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_ExpenseCategories_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_ExpenseCategories_Parent] FOREIGN KEY ([ParentId]) REFERENCES [ERP].[ExpenseCategories]([Id]),
      CONSTRAINT [FK_ERP_ExpenseCategories_Account] FOREIGN KEY ([AccountId]) REFERENCES [ERP].[Accounts]([Id]),
      CONSTRAINT [UQ_ERP_ExpenseCategories_Name] UNIQUE NONCLUSTERED ([CompanyId], [Name])
    );
  END;

  IF OBJECT_ID(N'[ERP].[Expenses]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[Expenses] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_Expenses_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [ExpenseCategoryId] UNIQUEIDENTIFIER NOT NULL,
      [SupplierId] UNIQUEIDENTIFIER NULL,
      [ExpenseNumber] NVARCHAR(50) NOT NULL,
      [Description] NVARCHAR(1000) NOT NULL,
      [ExpenseDate] DATE NOT NULL,
      [Amount] DECIMAL(19,4) NOT NULL,
      [TaxAmount] DECIMAL(19,4) NOT NULL CONSTRAINT [DF_ERP_Expenses_TaxAmount] DEFAULT (0),
      [TotalAmount] DECIMAL(19,4) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [PaymentStatus] NVARCHAR(40) NOT NULL,
      [Reference] NVARCHAR(255) NULL,
      [ReceiptUrl] NVARCHAR(1000) NULL,
      [CreatedByUserId] UNIQUEIDENTIFIER NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Expenses_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_Expenses_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_Expenses] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_Expenses_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_Expenses_Category] FOREIGN KEY ([ExpenseCategoryId]) REFERENCES [ERP].[ExpenseCategories]([Id]),
      CONSTRAINT [FK_ERP_Expenses_Supplier] FOREIGN KEY ([SupplierId]) REFERENCES [Commerce].[Suppliers]([Id]),
      CONSTRAINT [UQ_ERP_Expenses_Number] UNIQUE NONCLUSTERED ([CompanyId], [ExpenseNumber]),
      CONSTRAINT [CK_ERP_Expenses_Amounts] CHECK ([Amount] >= 0 AND [TaxAmount] >= 0 AND [TotalAmount] >= 0)
    );
  END;

  IF OBJECT_ID(N'[ERP].[TaxRates]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[TaxRates] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_TaxRates_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [CountryCode] CHAR(2) NOT NULL,
      [StateProvince] NVARCHAR(120) NULL,
      [TaxCode] NVARCHAR(50) NOT NULL,
      [TaxName] NVARCHAR(200) NOT NULL,
      [TaxType] NVARCHAR(50) NOT NULL,
      [Rate] DECIMAL(19,8) NOT NULL,
      [ValidFrom] DATE NOT NULL,
      [ValidTo] DATE NULL,
      [IsActive] BIT NOT NULL CONSTRAINT [DF_ERP_TaxRates_IsActive] DEFAULT (1),
      CONSTRAINT [PK_ERP_TaxRates] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_TaxRates_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [UQ_ERP_TaxRates_CodeDate] UNIQUE NONCLUSTERED ([CompanyId], [TaxCode], [ValidFrom]),
      CONSTRAINT [CK_ERP_TaxRates_Rate] CHECK ([Rate] >= 0),
      CONSTRAINT [CK_ERP_TaxRates_Dates] CHECK ([ValidTo] IS NULL OR [ValidFrom] <= [ValidTo])
    );
  END;

  IF OBJECT_ID(N'[ERP].[TaxTransactions]', N'U') IS NULL
  BEGIN
    CREATE TABLE [ERP].[TaxTransactions] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ERP_TaxTransactions_Id] DEFAULT NEWSEQUENTIALID(),
      [CompanyId] UNIQUEIDENTIFIER NOT NULL,
      [OrderId] UNIQUEIDENTIFIER NULL,
      [InvoiceId] UNIQUEIDENTIFIER NULL,
      [SupplierBillId] UNIQUEIDENTIFIER NULL,
      [TaxCode] NVARCHAR(50) NOT NULL,
      [TaxableAmount] DECIMAL(19,4) NOT NULL,
      [TaxAmount] DECIMAL(19,4) NOT NULL,
      [Currency] CHAR(3) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ERP_TaxTransactions_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_ERP_TaxTransactions] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_ERP_TaxTransactions_Company] FOREIGN KEY ([CompanyId]) REFERENCES [ERP].[Companies]([Id]),
      CONSTRAINT [FK_ERP_TaxTransactions_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [FK_ERP_TaxTransactions_Invoice] FOREIGN KEY ([InvoiceId]) REFERENCES [ERP].[Invoices]([Id]),
      CONSTRAINT [FK_ERP_TaxTransactions_SupplierBill] FOREIGN KEY ([SupplierBillId]) REFERENCES [ERP].[SupplierBills]([Id]),
      CONSTRAINT [CK_ERP_TaxTransactions_Amounts] CHECK ([TaxableAmount] >= 0 AND [TaxAmount] >= 0)
    );
  END;

  /* Protect posted journals. Posting itself is performed by the API only
     after checking that total debits equal total credits. */
  IF OBJECT_ID(N'[ERP].[TR_JournalEntries_ProtectPosted]', N'TR') IS NULL
  BEGIN
    EXEC(N'
      CREATE TRIGGER [ERP].[TR_JournalEntries_ProtectPosted]
      ON [ERP].[JournalEntries]
      AFTER UPDATE, DELETE
      AS
      BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted WHERE [Status] IN (N''Posted'', N''Reversed''))
        BEGIN
          THROW 51001, ''Posted or reversed journal entries cannot be modified or deleted. Use a reversal entry.'', 1;
        END;
      END;
    ');
  END;

  IF OBJECT_ID(N'[ERP].[TR_JournalLines_ProtectPosted]', N'TR') IS NULL
  BEGIN
    EXEC(N'
      CREATE TRIGGER [ERP].[TR_JournalLines_ProtectPosted]
      ON [ERP].[JournalLines]
      AFTER INSERT, UPDATE, DELETE
      AS
      BEGIN
        SET NOCOUNT ON;
        IF EXISTS (
          SELECT 1
          FROM (
            SELECT [JournalEntryId] FROM inserted
            UNION
            SELECT [JournalEntryId] FROM deleted
          ) x
          JOIN [ERP].[JournalEntries] e ON e.[Id] = x.[JournalEntryId]
          WHERE e.[Status] IN (N''Posted'', N''Reversed'')
        )
        BEGIN
          THROW 51002, ''Lines belonging to posted or reversed journal entries cannot be modified.'', 1;
        END;
      END;
    ');
  END;

  /* ================================================================
     CRM: customer profile and engagement
     ================================================================ */
  IF OBJECT_ID(N'[CRM].[CustomerAddresses]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[CustomerAddresses] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_CustomerAddresses_Id] DEFAULT NEWSEQUENTIALID(),
      [CustomerId] UNIQUEIDENTIFIER NOT NULL,
      [AddressType] NVARCHAR(30) NOT NULL,
      [FirstName] NVARCHAR(120) NOT NULL,
      [LastName] NVARCHAR(120) NOT NULL,
      [Company] NVARCHAR(200) NULL,
      [Phone] NVARCHAR(40) NULL,
      [AddressLine1] NVARCHAR(255) NOT NULL,
      [AddressLine2] NVARCHAR(255) NULL,
      [City] NVARCHAR(120) NOT NULL,
      [StateProvince] NVARCHAR(120) NULL,
      [PostalCode] NVARCHAR(30) NOT NULL,
      [CountryCode] CHAR(2) NOT NULL,
      [IsDefault] BIT NOT NULL CONSTRAINT [DF_CRM_CustomerAddresses_IsDefault] DEFAULT (0),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_CustomerAddresses_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_CustomerAddresses_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_CustomerAddresses] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_CRM_CustomerAddresses_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]) ON DELETE CASCADE
    );
  END;

  IF OBJECT_ID(N'[CRM].[CustomerPreferences]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[CustomerPreferences] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_CustomerPreferences_Id] DEFAULT NEWSEQUENTIALID(),
      [CustomerId] UNIQUEIDENTIFIER NOT NULL,
      [PreferredLanguage] NVARCHAR(10) NULL,
      [PreferredCurrency] CHAR(3) NULL,
      [EmailMarketing] BIT NOT NULL CONSTRAINT [DF_CRM_CustomerPreferences_EmailMarketing] DEFAULT (0),
      [SMSMarketing] BIT NOT NULL CONSTRAINT [DF_CRM_CustomerPreferences_SMSMarketing] DEFAULT (0),
      [PushMarketing] BIT NOT NULL CONSTRAINT [DF_CRM_CustomerPreferences_PushMarketing] DEFAULT (0),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_CustomerPreferences_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_CustomerPreferences] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_CRM_CustomerPreferences_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]) ON DELETE CASCADE,
      CONSTRAINT [UQ_CRM_CustomerPreferences_Customer] UNIQUE NONCLUSTERED ([CustomerId])
    );
  END;

  IF OBJECT_ID(N'[CRM].[CustomerNotes]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[CustomerNotes] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_CustomerNotes_Id] DEFAULT NEWSEQUENTIALID(),
      [CustomerId] UNIQUEIDENTIFIER NOT NULL,
      [CreatedByUserId] UNIQUEIDENTIFIER NOT NULL,
      [Note] NVARCHAR(MAX) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_CustomerNotes_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_CustomerNotes] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_CRM_CustomerNotes_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]) ON DELETE CASCADE
    );
  END;

  IF OBJECT_ID(N'[CRM].[CustomerTags]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[CustomerTags] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_CustomerTags_Id] DEFAULT NEWSEQUENTIALID(),
      [Name] NVARCHAR(100) NOT NULL,
      [Description] NVARCHAR(500) NULL,
      CONSTRAINT [PK_CRM_CustomerTags] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_CRM_CustomerTags_Name] UNIQUE NONCLUSTERED ([Name])
    );
  END;

  IF OBJECT_ID(N'[CRM].[CustomerTagAssignments]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[CustomerTagAssignments] (
      [CustomerId] UNIQUEIDENTIFIER NOT NULL,
      [TagId] UNIQUEIDENTIFIER NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_CustomerTagAssignments_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_CustomerTagAssignments] PRIMARY KEY CLUSTERED ([CustomerId], [TagId]),
      CONSTRAINT [FK_CRM_CustomerTagAssignments_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_CRM_CustomerTagAssignments_Tag] FOREIGN KEY ([TagId]) REFERENCES [CRM].[CustomerTags]([Id]) ON DELETE CASCADE
    );
  END;

  IF OBJECT_ID(N'[CRM].[CustomerSegments]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[CustomerSegments] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_CustomerSegments_Id] DEFAULT NEWSEQUENTIALID(),
      [Name] NVARCHAR(200) NOT NULL,
      [Description] NVARCHAR(1000) NULL,
      [SegmentType] NVARCHAR(30) NOT NULL,
      [RuleJson] NVARCHAR(MAX) NULL,
      [IsActive] BIT NOT NULL CONSTRAINT [DF_CRM_CustomerSegments_IsActive] DEFAULT (1),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_CustomerSegments_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_CustomerSegments_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_CustomerSegments] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_CRM_CustomerSegments_Name] UNIQUE NONCLUSTERED ([Name]),
      CONSTRAINT [CK_CRM_CustomerSegments_Type] CHECK ([SegmentType] IN (N'Static', N'Dynamic')),
      CONSTRAINT [CK_CRM_CustomerSegments_RuleJson] CHECK ([RuleJson] IS NULL OR ISJSON([RuleJson]) = 1)
    );
  END;

  IF OBJECT_ID(N'[CRM].[CustomerSegmentMembers]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[CustomerSegmentMembers] (
      [SegmentId] UNIQUEIDENTIFIER NOT NULL,
      [CustomerId] UNIQUEIDENTIFIER NOT NULL,
      [AddedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_CustomerSegmentMembers_AddedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_CustomerSegmentMembers] PRIMARY KEY CLUSTERED ([SegmentId], [CustomerId]),
      CONSTRAINT [FK_CRM_CustomerSegmentMembers_Segment] FOREIGN KEY ([SegmentId]) REFERENCES [CRM].[CustomerSegments]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_CRM_CustomerSegmentMembers_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]) ON DELETE CASCADE
    );
  END;

  IF OBJECT_ID(N'[CRM].[Campaigns]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[Campaigns] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_Campaigns_Id] DEFAULT NEWSEQUENTIALID(),
      [Name] NVARCHAR(200) NOT NULL,
      [Channel] NVARCHAR(50) NOT NULL,
      [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_CRM_Campaigns_Status] DEFAULT N'Draft',
      [StartAt] DATETIME2(3) NULL,
      [EndAt] DATETIME2(3) NULL,
      [BudgetAmount] DECIMAL(19,4) NULL,
      [Currency] CHAR(3) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_Campaigns_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_Campaigns_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_Campaigns] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [CK_CRM_Campaigns_Dates] CHECK ([EndAt] IS NULL OR [StartAt] IS NULL OR [StartAt] <= [EndAt]),
      CONSTRAINT [CK_CRM_Campaigns_Budget] CHECK ([BudgetAmount] IS NULL OR [BudgetAmount] >= 0)
    );
  END;

  IF OBJECT_ID(N'[CRM].[CampaignEvents]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[CampaignEvents] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_CampaignEvents_Id] DEFAULT NEWSEQUENTIALID(),
      [CampaignId] UNIQUEIDENTIFIER NOT NULL,
      [CustomerId] UNIQUEIDENTIFIER NULL,
      [OrderId] UNIQUEIDENTIFIER NULL,
      [EventType] NVARCHAR(50) NOT NULL,
      [EventAt] DATETIME2(3) NOT NULL,
      [RevenueAmount] DECIMAL(19,4) NULL,
      [Currency] CHAR(3) NULL,
      CONSTRAINT [PK_CRM_CampaignEvents] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_CRM_CampaignEvents_Campaign] FOREIGN KEY ([CampaignId]) REFERENCES [CRM].[Campaigns]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_CRM_CampaignEvents_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [FK_CRM_CampaignEvents_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [CK_CRM_CampaignEvents_Revenue] CHECK ([RevenueAmount] IS NULL OR [RevenueAmount] >= 0)
    );
  END;

  /* ================================================================
     CRM: support
     ================================================================ */
  IF OBJECT_ID(N'[CRM].[Tickets]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[Tickets] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_Tickets_Id] DEFAULT NEWSEQUENTIALID(),
      [LegacyTicketId] INT IDENTITY(1,1) NOT NULL,
      [TicketNumber] NVARCHAR(40) NOT NULL,
      [CustomerId] UNIQUEIDENTIFIER NULL,
      [OrderId] UNIQUEIDENTIFIER NULL,
      [Subject] NVARCHAR(240) NOT NULL,
      [Category] NVARCHAR(60) NOT NULL,
      [Priority] NVARCHAR(20) NOT NULL CONSTRAINT [DF_CRM_Tickets_Priority] DEFAULT N'Normal',
      [Status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_CRM_Tickets_Status] DEFAULT N'New',
      [AssignedUserId] UNIQUEIDENTIFIER NULL,
      [CustomerNameSnapshot] NVARCHAR(200) NULL,
      [CustomerEmailSnapshot] NVARCHAR(255) NULL,
      [TagsJson] NVARCHAR(MAX) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_Tickets_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_Tickets_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      [ResolvedAt] DATETIME2(3) NULL,
      [ClosedAt] DATETIME2(3) NULL,
      CONSTRAINT [PK_CRM_Tickets] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_CRM_Tickets_LegacyTicketId] UNIQUE NONCLUSTERED ([LegacyTicketId]),
      CONSTRAINT [UQ_CRM_Tickets_TicketNumber] UNIQUE NONCLUSTERED ([TicketNumber]),
      CONSTRAINT [FK_CRM_Tickets_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [FK_CRM_Tickets_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [CK_CRM_Tickets_TagsJson] CHECK ([TagsJson] IS NULL OR ISJSON([TagsJson]) = 1)
    );
  END;

  IF OBJECT_ID(N'[CRM].[TicketMessages]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[TicketMessages] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_TicketMessages_Id] DEFAULT NEWSEQUENTIALID(),
      [TicketId] UNIQUEIDENTIFIER NOT NULL,
      [SenderType] NVARCHAR(20) NOT NULL,
      [SenderUserId] UNIQUEIDENTIFIER NULL,
      [SenderCustomerId] UNIQUEIDENTIFIER NULL,
      [Message] NVARCHAR(MAX) NOT NULL,
      [MessageHtml] NVARCHAR(MAX) NULL,
      [AttachmentsJson] NVARCHAR(MAX) NULL,
      [IsInternal] BIT NOT NULL CONSTRAINT [DF_CRM_TicketMessages_IsInternal] DEFAULT (0),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_TicketMessages_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_TicketMessages] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_CRM_TicketMessages_Ticket] FOREIGN KEY ([TicketId]) REFERENCES [CRM].[Tickets]([Id]) ON DELETE CASCADE,
      CONSTRAINT [FK_CRM_TicketMessages_Customer] FOREIGN KEY ([SenderCustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [CK_CRM_TicketMessages_AttachmentsJson] CHECK ([AttachmentsJson] IS NULL OR ISJSON([AttachmentsJson]) = 1)
    );
  END;

  IF OBJECT_ID(N'[CRM].[TicketEvents]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[TicketEvents] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_TicketEvents_Id] DEFAULT NEWSEQUENTIALID(),
      [TicketId] UNIQUEIDENTIFIER NOT NULL,
      [EventType] NVARCHAR(80) NOT NULL,
      [PreviousValue] NVARCHAR(MAX) NULL,
      [NewValue] NVARCHAR(MAX) NULL,
      [PerformedByUserId] UNIQUEIDENTIFIER NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_TicketEvents_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_TicketEvents] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_CRM_TicketEvents_Ticket] FOREIGN KEY ([TicketId]) REFERENCES [CRM].[Tickets]([Id]) ON DELETE CASCADE
    );
  END;

  /* ================================================================
     CRM: loyalty
     ================================================================ */
  IF OBJECT_ID(N'[CRM].[LoyaltyTiers]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[LoyaltyTiers] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_LoyaltyTiers_Id] DEFAULT NEWSEQUENTIALID(),
      [Name] NVARCHAR(100) NOT NULL,
      [MinimumLifetimeValue] DECIMAL(19,4) NULL,
      [MinimumPoints] INT NULL,
      [BenefitsJson] NVARCHAR(MAX) NULL,
      [SortOrder] INT NOT NULL CONSTRAINT [DF_CRM_LoyaltyTiers_SortOrder] DEFAULT (0),
      [IsActive] BIT NOT NULL CONSTRAINT [DF_CRM_LoyaltyTiers_IsActive] DEFAULT (1),
      CONSTRAINT [PK_CRM_LoyaltyTiers] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [UQ_CRM_LoyaltyTiers_Name] UNIQUE NONCLUSTERED ([Name]),
      CONSTRAINT [CK_CRM_LoyaltyTiers_Thresholds] CHECK (([MinimumLifetimeValue] IS NULL OR [MinimumLifetimeValue] >= 0) AND ([MinimumPoints] IS NULL OR [MinimumPoints] >= 0)),
      CONSTRAINT [CK_CRM_LoyaltyTiers_BenefitsJson] CHECK ([BenefitsJson] IS NULL OR ISJSON([BenefitsJson]) = 1)
    );
  END;

  IF OBJECT_ID(N'[CRM].[LoyaltyAccounts]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[LoyaltyAccounts] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_LoyaltyAccounts_Id] DEFAULT NEWSEQUENTIALID(),
      [CustomerId] UNIQUEIDENTIFIER NOT NULL,
      [PointsBalance] INT NOT NULL CONSTRAINT [DF_CRM_LoyaltyAccounts_PointsBalance] DEFAULT (0),
      [LifetimePointsEarned] INT NOT NULL CONSTRAINT [DF_CRM_LoyaltyAccounts_LifetimePointsEarned] DEFAULT (0),
      [TierId] UNIQUEIDENTIFIER NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_LoyaltyAccounts_CreatedAt] DEFAULT SYSUTCDATETIME(),
      [UpdatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_LoyaltyAccounts_UpdatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_LoyaltyAccounts] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_CRM_LoyaltyAccounts_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [CRM].[Customers]([Id]),
      CONSTRAINT [FK_CRM_LoyaltyAccounts_Tier] FOREIGN KEY ([TierId]) REFERENCES [CRM].[LoyaltyTiers]([Id]),
      CONSTRAINT [UQ_CRM_LoyaltyAccounts_Customer] UNIQUE NONCLUSTERED ([CustomerId]),
      CONSTRAINT [CK_CRM_LoyaltyAccounts_Points] CHECK ([PointsBalance] >= 0 AND [LifetimePointsEarned] >= 0)
    );
  END;

  IF OBJECT_ID(N'[CRM].[LoyaltyTransactions]', N'U') IS NULL
  BEGIN
    CREATE TABLE [CRM].[LoyaltyTransactions] (
      [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CRM_LoyaltyTransactions_Id] DEFAULT NEWSEQUENTIALID(),
      [LoyaltyAccountId] UNIQUEIDENTIFIER NOT NULL,
      [Type] NVARCHAR(20) NOT NULL,
      [Points] INT NOT NULL,
      [OrderId] UNIQUEIDENTIFIER NULL,
      [Description] NVARCHAR(500) NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CRM_LoyaltyTransactions_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_CRM_LoyaltyTransactions] PRIMARY KEY CLUSTERED ([Id]),
      CONSTRAINT [FK_CRM_LoyaltyTransactions_Account] FOREIGN KEY ([LoyaltyAccountId]) REFERENCES [CRM].[LoyaltyAccounts]([Id]),
      CONSTRAINT [FK_CRM_LoyaltyTransactions_Order] FOREIGN KEY ([OrderId]) REFERENCES [Commerce].[Orders]([Id]),
      CONSTRAINT [CK_CRM_LoyaltyTransactions_Type] CHECK ([Type] IN (N'Earn', N'Redeem', N'Expire', N'Adjustment')),
      CONSTRAINT [CK_CRM_LoyaltyTransactions_Points] CHECK ([Points] <> 0)
    );
  END;

  /* ================================================================
     Access-pattern and foreign-key indexes. Constraint-backed indexes
     are not duplicated.
     ================================================================ */
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_Products_Status' AND [object_id]=OBJECT_ID(N'[Commerce].[Products]')) CREATE INDEX [IX_Commerce_Products_Status] ON [Commerce].[Products]([Status], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_ProductVariants_Product' AND [object_id]=OBJECT_ID(N'[Commerce].[ProductVariants]')) CREATE INDEX [IX_Commerce_ProductVariants_Product] ON [Commerce].[ProductVariants]([ProductId], [Status]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_Categories_Parent' AND [object_id]=OBJECT_ID(N'[Commerce].[Categories]')) CREATE INDEX [IX_Commerce_Categories_Parent] ON [Commerce].[Categories]([ParentId], [SortOrder]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_ProductCategories_Category' AND [object_id]=OBJECT_ID(N'[Commerce].[ProductCategories]')) CREATE INDEX [IX_Commerce_ProductCategories_Category] ON [Commerce].[ProductCategories]([CategoryId], [SortOrder]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_ProductImages_Product' AND [object_id]=OBJECT_ID(N'[Commerce].[ProductImages]')) CREATE INDEX [IX_Commerce_ProductImages_Product] ON [Commerce].[ProductImages]([ProductId], [IsPrimary] DESC, [SortOrder]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_ProductVideos_Product' AND [object_id]=OBJECT_ID(N'[Commerce].[ProductVideos]')) CREATE INDEX [IX_Commerce_ProductVideos_Product] ON [Commerce].[ProductVideos]([ProductId], [SortOrder]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_ProductAttributeValues_Product' AND [object_id]=OBJECT_ID(N'[Commerce].[ProductAttributeValues]')) CREATE INDEX [IX_Commerce_ProductAttributeValues_Product] ON [Commerce].[ProductAttributeValues]([ProductId], [AttributeId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_ProductAttributeValues_Variant' AND [object_id]=OBJECT_ID(N'[Commerce].[ProductAttributeValues]')) CREATE INDEX [IX_Commerce_ProductAttributeValues_Variant] ON [Commerce].[ProductAttributeValues]([VariantId], [AttributeId]) WHERE [VariantId] IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_Orders_Customer' AND [object_id]=OBJECT_ID(N'[Commerce].[Orders]')) CREATE INDEX [IX_Commerce_Orders_Customer] ON [Commerce].[Orders]([CustomerId], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_Orders_Status' AND [object_id]=OBJECT_ID(N'[Commerce].[Orders]')) CREATE INDEX [IX_Commerce_Orders_Status] ON [Commerce].[Orders]([OrderStatus], [PaymentStatus], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_Orders_CreatedAt' AND [object_id]=OBJECT_ID(N'[Commerce].[Orders]')) CREATE INDEX [IX_Commerce_Orders_CreatedAt] ON [Commerce].[Orders]([CreatedAt] DESC) INCLUDE ([TotalAmount], [Currency], [CustomerId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_OrderItems_Order' AND [object_id]=OBJECT_ID(N'[Commerce].[OrderItems]')) CREATE INDEX [IX_Commerce_OrderItems_Order] ON [Commerce].[OrderItems]([OrderId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_OrderItems_Product' AND [object_id]=OBJECT_ID(N'[Commerce].[OrderItems]')) CREATE INDEX [IX_Commerce_OrderItems_Product] ON [Commerce].[OrderItems]([ProductId], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_OrderItems_Variant' AND [object_id]=OBJECT_ID(N'[Commerce].[OrderItems]')) CREATE INDEX [IX_Commerce_OrderItems_Variant] ON [Commerce].[OrderItems]([VariantId]) WHERE [VariantId] IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_OrderStatusHistory_Order' AND [object_id]=OBJECT_ID(N'[Commerce].[OrderStatusHistory]')) CREATE INDEX [IX_Commerce_OrderStatusHistory_Order] ON [Commerce].[OrderStatusHistory]([OrderId], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_CheckoutAttempts_Status' AND [object_id]=OBJECT_ID(N'[Commerce].[CheckoutAttempts]')) CREATE INDEX [IX_Commerce_CheckoutAttempts_Status] ON [Commerce].[CheckoutAttempts]([CheckoutStatus], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_CheckoutAttempts_Customer' AND [object_id]=OBJECT_ID(N'[Commerce].[CheckoutAttempts]')) CREATE INDEX [IX_Commerce_CheckoutAttempts_Customer] ON [Commerce].[CheckoutAttempts]([CustomerId], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_Shipments_Order' AND [object_id]=OBJECT_ID(N'[Commerce].[Shipments]')) CREATE INDEX [IX_Commerce_Shipments_Order] ON [Commerce].[Shipments]([OrderId], [Status]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_Shipments_Status' AND [object_id]=OBJECT_ID(N'[Commerce].[Shipments]')) CREATE INDEX [IX_Commerce_Shipments_Status] ON [Commerce].[Shipments]([Status], [UpdatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_ShipmentItems_OrderItem' AND [object_id]=OBJECT_ID(N'[Commerce].[ShipmentItems]')) CREATE INDEX [IX_Commerce_ShipmentItems_OrderItem] ON [Commerce].[ShipmentItems]([OrderItemId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_TrackingEvents_Shipment' AND [object_id]=OBJECT_ID(N'[Commerce].[TrackingEvents]')) CREATE INDEX [IX_Commerce_TrackingEvents_Shipment] ON [Commerce].[TrackingEvents]([ShipmentId], [EventAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_SupplierProducts_Supplier' AND [object_id]=OBJECT_ID(N'[Commerce].[SupplierProducts]')) CREATE INDEX [IX_Commerce_SupplierProducts_Supplier] ON [Commerce].[SupplierProducts]([SupplierId], [SyncStatus]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_SupplierProducts_Product' AND [object_id]=OBJECT_ID(N'[Commerce].[SupplierProducts]')) CREATE INDEX [IX_Commerce_SupplierProducts_Product] ON [Commerce].[SupplierProducts]([ProductId], [VariantId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_SupplierOrders_Supplier' AND [object_id]=OBJECT_ID(N'[Commerce].[SupplierOrders]')) CREATE INDEX [IX_Commerce_SupplierOrders_Supplier] ON [Commerce].[SupplierOrders]([SupplierId], [Status], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_SupplierOrders_Order' AND [object_id]=OBJECT_ID(N'[Commerce].[SupplierOrders]')) CREATE INDEX [IX_Commerce_SupplierOrders_Order] ON [Commerce].[SupplierOrders]([OrderId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_SupplierOrderItems_OrderItem' AND [object_id]=OBJECT_ID(N'[Commerce].[SupplierOrderItems]')) CREATE INDEX [IX_Commerce_SupplierOrderItems_OrderItem] ON [Commerce].[SupplierOrderItems]([OrderItemId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_Commerce_SupplierSyncLogs_Supplier' AND [object_id]=OBJECT_ID(N'[Commerce].[SupplierSyncLogs]')) CREATE INDEX [IX_Commerce_SupplierSyncLogs_Supplier] ON [Commerce].[SupplierSyncLogs]([SupplierId], [Status], [StartedAt] DESC);

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_FiscalYears_Company' AND [object_id]=OBJECT_ID(N'[ERP].[FiscalYears]')) CREATE INDEX [IX_ERP_FiscalYears_Company] ON [ERP].[FiscalYears]([CompanyId], [StartDate]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_FiscalPeriods_Year' AND [object_id]=OBJECT_ID(N'[ERP].[FiscalPeriods]')) CREATE INDEX [IX_ERP_FiscalPeriods_Year] ON [ERP].[FiscalPeriods]([FiscalYearId], [StartDate]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Accounts_Parent' AND [object_id]=OBJECT_ID(N'[ERP].[Accounts]')) CREATE INDEX [IX_ERP_Accounts_Parent] ON [ERP].[Accounts]([ParentAccountId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_CostCenters_Parent' AND [object_id]=OBJECT_ID(N'[ERP].[CostCenters]')) CREATE INDEX [IX_ERP_CostCenters_Parent] ON [ERP].[CostCenters]([ParentId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_JournalEntries_Posting' AND [object_id]=OBJECT_ID(N'[ERP].[JournalEntries]')) CREATE INDEX [IX_ERP_JournalEntries_Posting] ON [ERP].[JournalEntries]([CompanyId], [PostingDate], [Status]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_JournalEntries_Period' AND [object_id]=OBJECT_ID(N'[ERP].[JournalEntries]')) CREATE INDEX [IX_ERP_JournalEntries_Period] ON [ERP].[JournalEntries]([FiscalPeriodId], [Status]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_JournalLines_Entry' AND [object_id]=OBJECT_ID(N'[ERP].[JournalLines]')) CREATE INDEX [IX_ERP_JournalLines_Entry] ON [ERP].[JournalLines]([JournalEntryId], [AccountId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_JournalLines_Account' AND [object_id]=OBJECT_ID(N'[ERP].[JournalLines]')) CREATE INDEX [IX_ERP_JournalLines_Account] ON [ERP].[JournalLines]([AccountId], [JournalEntryId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Invoices_Customer' AND [object_id]=OBJECT_ID(N'[ERP].[Invoices]')) CREATE INDEX [IX_ERP_Invoices_Customer] ON [ERP].[Invoices]([CustomerId], [Status], [DueDate]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Invoices_Order' AND [object_id]=OBJECT_ID(N'[ERP].[Invoices]')) CREATE INDEX [IX_ERP_Invoices_Order] ON [ERP].[Invoices]([OrderId]) WHERE [OrderId] IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_InvoiceItems_Invoice' AND [object_id]=OBJECT_ID(N'[ERP].[InvoiceItems]')) CREATE INDEX [IX_ERP_InvoiceItems_Invoice] ON [ERP].[InvoiceItems]([InvoiceId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_SupplierBills_Supplier' AND [object_id]=OBJECT_ID(N'[ERP].[SupplierBills]')) CREATE INDEX [IX_ERP_SupplierBills_Supplier] ON [ERP].[SupplierBills]([SupplierId], [Status], [DueDate]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Payments_Order' AND [object_id]=OBJECT_ID(N'[ERP].[Payments]')) CREATE INDEX [IX_ERP_Payments_Order] ON [ERP].[Payments]([OrderId], [Status]) WHERE [OrderId] IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Payments_Invoice' AND [object_id]=OBJECT_ID(N'[ERP].[Payments]')) CREATE INDEX [IX_ERP_Payments_Invoice] ON [ERP].[Payments]([InvoiceId], [Status]) WHERE [InvoiceId] IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Payments_SupplierBill' AND [object_id]=OBJECT_ID(N'[ERP].[Payments]')) CREATE INDEX [IX_ERP_Payments_SupplierBill] ON [ERP].[Payments]([SupplierBillId], [Status]) WHERE [SupplierBillId] IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Payments_ProcessedAt' AND [object_id]=OBJECT_ID(N'[ERP].[Payments]')) CREATE INDEX [IX_ERP_Payments_ProcessedAt] ON [ERP].[Payments]([ProcessedAt] DESC, [Direction], [Status]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Refunds_Payment' AND [object_id]=OBJECT_ID(N'[ERP].[Refunds]')) CREATE INDEX [IX_ERP_Refunds_Payment] ON [ERP].[Refunds]([PaymentId], [Status]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Refunds_Order' AND [object_id]=OBJECT_ID(N'[ERP].[Refunds]')) CREATE INDEX [IX_ERP_Refunds_Order] ON [ERP].[Refunds]([OrderId], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_BankTransactions_Account' AND [object_id]=OBJECT_ID(N'[ERP].[BankTransactions]')) CREATE INDEX [IX_ERP_BankTransactions_Account] ON [ERP].[BankTransactions]([BankAccountId], [TransactionDate] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_ExpenseCategories_Parent' AND [object_id]=OBJECT_ID(N'[ERP].[ExpenseCategories]')) CREATE INDEX [IX_ERP_ExpenseCategories_Parent] ON [ERP].[ExpenseCategories]([ParentId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Expenses_Period' AND [object_id]=OBJECT_ID(N'[ERP].[Expenses]')) CREATE INDEX [IX_ERP_Expenses_Period] ON [ERP].[Expenses]([CompanyId], [ExpenseDate], [PaymentStatus]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_Expenses_Category' AND [object_id]=OBJECT_ID(N'[ERP].[Expenses]')) CREATE INDEX [IX_ERP_Expenses_Category] ON [ERP].[Expenses]([ExpenseCategoryId], [ExpenseDate] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_ERP_TaxTransactions_Company' AND [object_id]=OBJECT_ID(N'[ERP].[TaxTransactions]')) CREATE INDEX [IX_ERP_TaxTransactions_Company] ON [ERP].[TaxTransactions]([CompanyId], [CreatedAt] DESC, [TaxCode]);

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_Customers_CreatedAt' AND [object_id]=OBJECT_ID(N'[CRM].[Customers]')) CREATE INDEX [IX_CRM_Customers_CreatedAt] ON [CRM].[Customers]([CreatedAt] DESC, [Status]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_CustomerAddresses_Customer' AND [object_id]=OBJECT_ID(N'[CRM].[CustomerAddresses]')) CREATE INDEX [IX_CRM_CustomerAddresses_Customer] ON [CRM].[CustomerAddresses]([CustomerId], [IsDefault] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_CustomerNotes_Customer' AND [object_id]=OBJECT_ID(N'[CRM].[CustomerNotes]')) CREATE INDEX [IX_CRM_CustomerNotes_Customer] ON [CRM].[CustomerNotes]([CustomerId], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_CustomerTagAssignments_Tag' AND [object_id]=OBJECT_ID(N'[CRM].[CustomerTagAssignments]')) CREATE INDEX [IX_CRM_CustomerTagAssignments_Tag] ON [CRM].[CustomerTagAssignments]([TagId], [CustomerId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_CustomerSegmentMembers_Customer' AND [object_id]=OBJECT_ID(N'[CRM].[CustomerSegmentMembers]')) CREATE INDEX [IX_CRM_CustomerSegmentMembers_Customer] ON [CRM].[CustomerSegmentMembers]([CustomerId], [SegmentId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_Campaigns_Status' AND [object_id]=OBJECT_ID(N'[CRM].[Campaigns]')) CREATE INDEX [IX_CRM_Campaigns_Status] ON [CRM].[Campaigns]([Status], [StartAt], [EndAt]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_CampaignEvents_Campaign' AND [object_id]=OBJECT_ID(N'[CRM].[CampaignEvents]')) CREATE INDEX [IX_CRM_CampaignEvents_Campaign] ON [CRM].[CampaignEvents]([CampaignId], [EventAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_CampaignEvents_Order' AND [object_id]=OBJECT_ID(N'[CRM].[CampaignEvents]')) CREATE INDEX [IX_CRM_CampaignEvents_Order] ON [CRM].[CampaignEvents]([OrderId]) WHERE [OrderId] IS NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_Tickets_Customer' AND [object_id]=OBJECT_ID(N'[CRM].[Tickets]')) CREATE INDEX [IX_CRM_Tickets_Customer] ON [CRM].[Tickets]([CustomerId], [Status], [UpdatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_Tickets_StatusPriority' AND [object_id]=OBJECT_ID(N'[CRM].[Tickets]')) CREATE INDEX [IX_CRM_Tickets_StatusPriority] ON [CRM].[Tickets]([Status], [Priority], [CreatedAt] DESC);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_TicketMessages_Ticket' AND [object_id]=OBJECT_ID(N'[CRM].[TicketMessages]')) CREATE INDEX [IX_CRM_TicketMessages_Ticket] ON [CRM].[TicketMessages]([TicketId], [CreatedAt]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_TicketEvents_Ticket' AND [object_id]=OBJECT_ID(N'[CRM].[TicketEvents]')) CREATE INDEX [IX_CRM_TicketEvents_Ticket] ON [CRM].[TicketEvents]([TicketId], [CreatedAt]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_LoyaltyAccounts_Tier' AND [object_id]=OBJECT_ID(N'[CRM].[LoyaltyAccounts]')) CREATE INDEX [IX_CRM_LoyaltyAccounts_Tier] ON [CRM].[LoyaltyAccounts]([TierId]);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name]=N'IX_CRM_LoyaltyTransactions_Account' AND [object_id]=OBJECT_ID(N'[CRM].[LoyaltyTransactions]')) CREATE INDEX [IX_CRM_LoyaltyTransactions_Account] ON [CRM].[LoyaltyTransactions]([LoyaltyAccountId], [CreatedAt] DESC);

  /* ================================================================
     Guarded legacy data migration. No legacy row is updated or deleted.
     ================================================================ */
  IF OBJECT_ID(N'[dbo].[User_tbl]', N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.User_tbl', N'UserID') IS NOT NULL
     AND COL_LENGTH(N'dbo.User_tbl', N'Email') IS NOT NULL
  BEGIN
    SET IDENTITY_INSERT [CRM].[Customers] ON;
    INSERT INTO [CRM].[Customers] (
      [Id], [LegacyUserId], [CustomerNumber], [Username], [Email], [FirstName], [LastName], [FullName],
      [Status], [CustomerType], [Role], [MarketingConsent], [EmailVerified], [PasswordHash],
      [LastLoginIP], [LastLoginAt], [CreatedAt], [UpdatedAt]
    )
    SELECT NEWID(), u.[UserID], CONCAT(N'CUS-', RIGHT(REPLICATE(N'0', 10) + CONVERT(NVARCHAR(20), u.[UserID]), 10)),
           u.[Username], LOWER(LTRIM(RTRIM(u.[Email]))), N'', N'', u.[Username], N'Active', N'Retail',
           CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(u.[Role], N'')))) IN (N'owner', N'admin') THEN LOWER(LTRIM(RTRIM(u.[Role]))) ELSE N'customer' END,
           0, 0, u.[PasswordHash], u.[LastIP], u.[LastLogin],
           COALESCE(CONVERT(DATETIME2(3), u.[CreatedAt]), SYSUTCDATETIME()), SYSUTCDATETIME()
    FROM [dbo].[User_tbl] u
    WHERE NOT EXISTS (SELECT 1 FROM [CRM].[Customers] c WHERE c.[LegacyUserId] = u.[UserID] OR c.[Email] = LOWER(LTRIM(RTRIM(u.[Email]))));
    SET IDENTITY_INSERT [CRM].[Customers] OFF;
  END;

  IF OBJECT_ID(N'[dbo].[Products_tbl]', N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.Products_tbl', N'PID') IS NOT NULL
     AND COL_LENGTH(N'dbo.Products_tbl', N'Name') IS NOT NULL
  BEGIN
    SET IDENTITY_INSERT [Commerce].[Products] ON;
    INSERT INTO [Commerce].[Products] (
      [Id], [LegacyProductId], [SKU], [Name], [Slug], [ShortDescription], [Description], [Brand],
      [Status], [ProductType], [IsFeatured], [IsTrending], [PublishedAt], [CreatedAt], [UpdatedAt]
    )
    SELECT NEWID(), p.[PID], CONCAT(N'LEGACY-', p.[PID]), p.[Name], CONCAT(N'legacy-', p.[PID]),
           LEFT(p.[Description], 500), p.[Description], p.[Brand], N'Active', N'Physical',
           CASE WHEN COALESCE(p.[ChosenCount], 0) > 0 THEN 1 ELSE 0 END, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM [dbo].[Products_tbl] p
    WHERE NOT EXISTS (SELECT 1 FROM [Commerce].[Products] cp WHERE cp.[LegacyProductId] = p.[PID]);
    SET IDENTITY_INSERT [Commerce].[Products] OFF;

    INSERT INTO [Commerce].[ProductVariants] (
      [ProductId], [SKU], [VariantName], [Status], [CostPrice], [SellingPrice], [Currency], [AvailableQuantity], [LowStockThreshold]
    )
    SELECT cp.[Id], cp.[SKU], COALESCE(NULLIF(p.[Colort], N''), N'Default'), N'Active', 0,
           COALESCE(CONVERT(DECIMAL(19,4), p.[Price]), 0), 'USD', COALESCE(CONVERT(DECIMAL(19,4), p.[Stock]), 0), 5
    FROM [dbo].[Products_tbl] p
    JOIN [Commerce].[Products] cp ON cp.[LegacyProductId] = p.[PID]
    WHERE NOT EXISTS (SELECT 1 FROM [Commerce].[ProductVariants] v WHERE v.[ProductId] = cp.[Id]);

    UPDATE p
      SET [DefaultVariantId] = v.[Id]
    FROM [Commerce].[Products] p
    JOIN [Commerce].[ProductVariants] v ON v.[ProductId] = p.[Id]
    WHERE p.[DefaultVariantId] IS NULL;

    INSERT INTO [Commerce].[ProductImages] ([ProductId], [VariantId], [Url], [AltText], [SortOrder], [IsPrimary])
    SELECT cp.[Id], cp.[DefaultVariantId], p.[IMG], COALESCE(NULLIF(p.[Alt], N''), p.[Name]), 0, 1
    FROM [dbo].[Products_tbl] p
    JOIN [Commerce].[Products] cp ON cp.[LegacyProductId] = p.[PID]
    WHERE NULLIF(LTRIM(RTRIM(p.[IMG])), N'') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM [Commerce].[ProductImages] i WHERE i.[ProductId] = cp.[Id] AND i.[Url] = p.[IMG]);

    INSERT INTO [Commerce].[Categories] ([Name], [Slug], [Description], [SortOrder], [IsActive])
    SELECT DISTINCT LTRIM(RTRIM(p.[Category])), CONCAT(N'legacy-category-', ABS(CHECKSUM(LTRIM(RTRIM(p.[Category]))))), NULL, 0, 1
    FROM [dbo].[Products_tbl] p
    WHERE NULLIF(LTRIM(RTRIM(p.[Category])), N'') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM [Commerce].[Categories] c WHERE c.[Name] = LTRIM(RTRIM(p.[Category])));

    INSERT INTO [Commerce].[ProductCategories] ([ProductId], [CategoryId], [IsPrimary], [SortOrder])
    SELECT cp.[Id], c.[Id], 1, 0
    FROM [dbo].[Products_tbl] p
    JOIN [Commerce].[Products] cp ON cp.[LegacyProductId] = p.[PID]
    JOIN [Commerce].[Categories] c ON c.[Name] = LTRIM(RTRIM(p.[Category]))
    WHERE NOT EXISTS (SELECT 1 FROM [Commerce].[ProductCategories] pc WHERE pc.[ProductId] = cp.[Id] AND pc.[CategoryId] = c.[Id]);
  END;

  IF OBJECT_ID(N'[dbo].[CjImportedProducts_tbl]', N'U') IS NOT NULL
     AND OBJECT_ID(N'[dbo].[Products_tbl]', N'U') IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM [Commerce].[Suppliers] WHERE [Code] = N'CJ')
      INSERT INTO [Commerce].[Suppliers] ([Code], [Name], [SupplierType], [Status], [Website], [DefaultCurrency])
      VALUES (N'CJ', N'Fulfillment Partner', N'Dropshipping', N'Active', N'https://cjdropshipping.com', 'USD');

    INSERT INTO [Commerce].[SupplierProducts] (
      [SupplierId], [ProductId], [VariantId], [ExternalProductId], [ExternalVariantId], [SupplierSKU],
      [SupplierCost], [Currency], [SyncStatus], [LastSyncedAt], [CreatedAt], [UpdatedAt]
    )
    SELECT s.[Id], p.[Id], p.[DefaultVariantId], cj.[Pid], NULL, NULL,
           COALESCE(CONVERT(DECIMAL(19,4), cj.[Price]), 0), 'USD', N'Synced',
           COALESCE(CONVERT(DATETIME2(3), cj.[UpdatedAt]), CONVERT(DATETIME2(3), cj.[CreatedAt])),
           COALESCE(CONVERT(DATETIME2(3), cj.[CreatedAt]), SYSUTCDATETIME()),
           COALESCE(CONVERT(DATETIME2(3), cj.[UpdatedAt]), SYSUTCDATETIME())
    FROM [dbo].[CjImportedProducts_tbl] cj
    JOIN [Commerce].[Products] p ON p.[LegacyProductId] = cj.[ProductId]
    CROSS JOIN (SELECT TOP (1) [Id] FROM [Commerce].[Suppliers] WHERE [Code] = N'CJ') s
    WHERE NOT EXISTS (
      SELECT 1 FROM [Commerce].[SupplierProducts] sp
      WHERE sp.[SupplierId] = s.[Id] AND sp.[ExternalProductId] = cj.[Pid]
    );
  END;

  IF OBJECT_ID(N'[dbo].[Orders_tbl]', N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.Orders_tbl', N'OrderId') IS NOT NULL
     AND COL_LENGTH(N'dbo.Orders_tbl', N'Total') IS NOT NULL
  BEGIN
    INSERT INTO [Commerce].[Orders] (
      [LegacyOrderId], [OrderNumber], [CustomerId], [Currency], [OrderStatus], [PaymentStatus], [FulfillmentStatus],
      [SubtotalAmount], [DiscountAmount], [ShippingAmount], [TaxAmount], [RefundedAmount], [TotalAmount],
      [CustomerEmail], [SalesChannel], [Source], [PlacedAt], [PaidAt], [CreatedAt], [UpdatedAt]
    )
    SELECT o.[OrderId], o.[OrderId], c.[Id], 'USD', COALESCE(NULLIF(o.[Status], N''), N'Pending'),
           CASE WHEN LOWER(COALESCE(o.[Status], N'')) IN (N'paid', N'completed', N'delivered') THEN N'Paid' ELSE N'Pending' END,
           CASE WHEN LOWER(COALESCE(o.[Status], N'')) IN (N'shipped', N'delivered') THEN o.[Status] ELSE N'Unfulfilled' END,
           COALESCE(CONVERT(DECIMAL(19,4), o.[Total]), 0), 0, 0, 0, 0, COALESCE(CONVERT(DECIMAL(19,4), o.[Total]), 0),
           COALESCE(c.[Email], CONCAT(N'legacy-', o.[OrderId], N'@invalid.local')), N'Legacy', N'Orders_tbl',
           CONVERT(DATETIME2(3), o.[PlacedAt]), NULL, CONVERT(DATETIME2(3), o.[PlacedAt]), SYSUTCDATETIME()
    FROM [dbo].[Orders_tbl] o
    LEFT JOIN [CRM].[Customers] c ON CONVERT(NVARCHAR(64), c.[LegacyUserId]) = o.[UserId]
    WHERE NOT EXISTS (SELECT 1 FROM [Commerce].[Orders] co WHERE co.[LegacyOrderId] = o.[OrderId]);

    INSERT INTO [Commerce].[OrderItems] (
      [OrderId], [ProductId], [VariantId], [SKU], [ProductName], [VariantName], [Quantity], [UnitPrice],
      [DiscountAmount], [TaxAmount], [TotalAmount], [UnitCost], [CreatedAt]
    )
    SELECT co.[Id], p.[Id], p.[DefaultVariantId], COALESCE(NULLIF(j.[SKU], N''), p.[SKU], N'LEGACY-ITEM'),
           COALESCE(NULLIF(j.[ProductName], N''), p.[Name], N'Legacy order item'), j.[VariantName],
           CASE WHEN j.[Quantity] > 0 THEN j.[Quantity] ELSE 1 END,
           COALESCE(j.[UnitPrice], 0), 0, 0,
           (CASE WHEN j.[Quantity] > 0 THEN j.[Quantity] ELSE 1 END) * COALESCE(j.[UnitPrice], 0), NULL,
           COALESCE(co.[PlacedAt], co.[CreatedAt])
    FROM [dbo].[Orders_tbl] o
    JOIN [Commerce].[Orders] co ON co.[LegacyOrderId] = o.[OrderId]
    CROSS APPLY OPENJSON(CASE WHEN ISJSON(o.[Items]) = 1 THEN o.[Items] ELSE N'[]' END)
      WITH (
        [LegacyProductId] INT '$.productId',
        [SKU] NVARCHAR(100) '$.sku',
        [ProductName] NVARCHAR(255) '$.title',
        [VariantName] NVARCHAR(255) '$.variant',
        [Quantity] DECIMAL(19,4) '$.quantity',
        [UnitPrice] DECIMAL(19,4) '$.price'
      ) j
    LEFT JOIN [Commerce].[Products] p ON p.[LegacyProductId] = j.[LegacyProductId]
    WHERE NOT EXISTS (SELECT 1 FROM [Commerce].[OrderItems] oi WHERE oi.[OrderId] = co.[Id]);
  END;

  IF OBJECT_ID(N'[dbo].[tickets]', N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.tickets', N'id') IS NOT NULL
     AND COL_LENGTH(N'dbo.tickets', N'ticket_number') IS NOT NULL
  BEGIN
    SET IDENTITY_INSERT [CRM].[Tickets] ON;
    INSERT INTO [CRM].[Tickets] (
      [Id], [LegacyTicketId], [TicketNumber], [CustomerId], [OrderId], [Subject], [Category], [Priority], [Status],
      [CustomerNameSnapshot], [CustomerEmailSnapshot], [TagsJson], [CreatedAt], [UpdatedAt]
    )
    SELECT NEWID(), t.[id], t.[ticket_number], c.[Id], o.[Id], t.[subject], t.[category], t.[priority], t.[status],
           t.[customer_name], t.[customer_email], CASE WHEN ISJSON(t.[tags]) = 1 THEN t.[tags] ELSE NULL END,
           t.[created_at], t.[updated_at]
    FROM [dbo].[tickets] t
    LEFT JOIN [CRM].[Customers] c ON c.[LegacyUserId] = t.[user_id] OR c.[Email] = LOWER(LTRIM(RTRIM(t.[customer_email])))
    LEFT JOIN [Commerce].[Orders] o ON o.[LegacyOrderId] = t.[order_id]
    WHERE NOT EXISTS (SELECT 1 FROM [CRM].[Tickets] ct WHERE ct.[LegacyTicketId] = t.[id] OR ct.[TicketNumber] = t.[ticket_number]);
    SET IDENTITY_INSERT [CRM].[Tickets] OFF;

    IF OBJECT_ID(N'[dbo].[ticket_messages]', N'U') IS NOT NULL
    BEGIN
      INSERT INTO [CRM].[TicketMessages] ([TicketId], [SenderType], [Message], [MessageHtml], [AttachmentsJson], [IsInternal], [CreatedAt])
      SELECT ct.[Id], m.[sender_type], m.[content_text], m.[content_html],
             CASE WHEN ISJSON(m.[attachments]) = 1 THEN m.[attachments] ELSE NULL END,
             CASE WHEN m.[visibility] = N'internal' THEN 1 ELSE 0 END, m.[created_at]
      FROM [dbo].[ticket_messages] m
      JOIN [CRM].[Tickets] ct ON ct.[LegacyTicketId] = m.[ticket_id]
      WHERE NOT EXISTS (
        SELECT 1 FROM [CRM].[TicketMessages] cm
        WHERE cm.[TicketId] = ct.[Id] AND cm.[CreatedAt] = m.[created_at] AND cm.[Message] = m.[content_text]
      );
    END;

    IF OBJECT_ID(N'[dbo].[ticket_events]', N'U') IS NOT NULL
    BEGIN
      INSERT INTO [CRM].[TicketEvents] ([TicketId], [EventType], [PreviousValue], [NewValue], [CreatedAt])
      SELECT ct.[Id], e.[action], e.[old_value], e.[new_value], e.[created_at]
      FROM [dbo].[ticket_events] e
      JOIN [CRM].[Tickets] ct ON ct.[LegacyTicketId] = e.[ticket_id]
      WHERE NOT EXISTS (
        SELECT 1 FROM [CRM].[TicketEvents] ce
        WHERE ce.[TicketId] = ct.[Id] AND ce.[CreatedAt] = e.[created_at] AND ce.[EventType] = e.[action]
      );
    END;
  END;

  /* ================================================================
     Read compatibility for legacy code paths when the legacy table does
     not exist. Canonical APIs perform all new writes.
     ================================================================ */
  IF OBJECT_ID(N'[dbo].[User_tbl]', N'U') IS NULL AND OBJECT_ID(N'[dbo].[User_tbl]', N'V') IS NULL
  BEGIN
    EXEC(N'
      CREATE VIEW [dbo].[User_tbl] AS
      SELECT [LegacyUserId] AS [UserID], [Username], [Email], [PasswordHash], [Role], [CreatedAt],
             [LastLoginAt] AS [LastLogin], [LastLoginIP] AS [LastIP], [FullName], [AvatarUrl], [Bio],
             [Country], [State], [City], [Zip], [Address], [SignupIP], [IsActive] AS [Active],
             CASE WHEN [DeletedAt] IS NULL THEN CONVERT(BIT, 0) ELSE CONVERT(BIT, 1) END AS [IsDeleted]
      FROM [CRM].[Customers];
    ');
  END;

  IF OBJECT_ID(N'[dbo].[User_tbl]', N'V') IS NOT NULL AND OBJECT_ID(N'[dbo].[TR_User_tbl_Insert]', N'TR') IS NULL
  BEGIN
    EXEC(N'
      CREATE TRIGGER [dbo].[TR_User_tbl_Insert] ON [dbo].[User_tbl]
      INSTEAD OF INSERT AS
      BEGIN
        SET NOCOUNT ON;
        INSERT INTO [CRM].[Customers] (
          [CustomerNumber], [Username], [Email], [FirstName], [LastName], [FullName], [Status], [CustomerType],
          [Role], [MarketingConsent], [EmailVerified], [PasswordHash], [AvatarUrl], [Bio], [Country], [State],
          [City], [Zip], [Address], [SignupIP], [LastLoginIP], [LastLoginAt], [CreatedAt], [UpdatedAt]
        )
        SELECT CONCAT(N''CUS-'', REPLACE(CONVERT(NVARCHAR(36), NEWID()), N''-'', N'''')), i.[Username], LOWER(LTRIM(RTRIM(i.[Email]))),
               N'''', N'''', i.[FullName], N''Active'', N''Retail'',
               CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(i.[Role], N'''')))) IN (N''owner'', N''admin'') THEN LOWER(LTRIM(RTRIM(i.[Role]))) ELSE N''customer'' END,
               0, 0,
               i.[PasswordHash], i.[AvatarUrl], i.[Bio], i.[Country], i.[State], i.[City], i.[Zip], i.[Address],
               i.[SignupIP], i.[LastIP], i.[LastLogin], COALESCE(i.[CreatedAt], SYSUTCDATETIME()), SYSUTCDATETIME()
        FROM inserted i;
      END;
    ');
  END;

  IF OBJECT_ID(N'[dbo].[Products_tbl]', N'U') IS NULL AND OBJECT_ID(N'[dbo].[Products_tbl]', N'V') IS NULL
  BEGIN
    EXEC(N'
      CREATE VIEW [dbo].[Products_tbl] AS
      SELECT p.[Brand], p.[Name], img.[Url] AS [IMG], cat.[Name] AS [Category], v.[VariantName] AS [Colort],
             CONVERT(INT, FLOOR(v.[AvailableQuantity])) AS [Stock], p.[LegacyProductId] AS [PID],
             v.[SellingPrice] AS [Price], p.[Description], img.[AltText] AS [Alt],
             CONVERT(INT, COALESCE(sales.[ChosenCount], 0)) AS [ChosenCount]
      FROM [Commerce].[Products] p
      LEFT JOIN [Commerce].[ProductVariants] v ON v.[Id] = p.[DefaultVariantId]
      OUTER APPLY (SELECT TOP (1) i.[Url], i.[AltText] FROM [Commerce].[ProductImages] i WHERE i.[ProductId] = p.[Id] ORDER BY i.[IsPrimary] DESC, i.[SortOrder], i.[CreatedAt]) img
      OUTER APPLY (SELECT TOP (1) c.[Name] FROM [Commerce].[ProductCategories] pc JOIN [Commerce].[Categories] c ON c.[Id] = pc.[CategoryId] WHERE pc.[ProductId] = p.[Id] ORDER BY pc.[IsPrimary] DESC, pc.[SortOrder]) cat
      OUTER APPLY (SELECT SUM(oi.[Quantity]) AS [ChosenCount] FROM [Commerce].[OrderItems] oi WHERE oi.[ProductId] = p.[Id]) sales;
    ');
  END;

  IF OBJECT_ID(N'[dbo].[Orders_tbl]', N'U') IS NULL AND OBJECT_ID(N'[dbo].[Orders_tbl]', N'V') IS NULL
  BEGIN
    EXEC(N'
      CREATE VIEW [dbo].[Orders_tbl] AS
      SELECT COALESCE([LegacyOrderId], CONVERT(NVARCHAR(64), [Id])) AS [OrderId],
             CONVERT(NVARCHAR(64), c.[LegacyUserId]) AS [UserId], o.[OrderStatus] AS [Status], o.[TotalAmount] AS [Total],
             CONVERT(NVARCHAR(MAX), N''[]'') AS [Items], o.[PlacedAt], o.[Currency],
             CASE WHEN o.[PaymentStatus] = N''Paid'' THEN o.[TotalAmount] ELSE CONVERT(DECIMAL(19,4), 0) END AS [AmountPaid],
             o.[PaidAt], o.[FulfillmentStatus]
      FROM [Commerce].[Orders] o
      LEFT JOIN [CRM].[Customers] c ON c.[Id] = o.[CustomerId];
    ');
  END;

  IF OBJECT_ID(N'[dbo].[CjImportedProducts_tbl]', N'U') IS NULL AND OBJECT_ID(N'[dbo].[CjImportedProducts_tbl]', N'V') IS NULL
  BEGIN
    EXEC(N'
      CREATE VIEW [dbo].[CjImportedProducts_tbl] AS
      SELECT sp.[Id], sp.[ExternalProductId] AS [Pid], p.[LegacyProductId] AS [ProductId], sp.[SupplierCost] AS [Price],
             CONVERT(NVARCHAR(MAX), NULL) AS [RawJson], sp.[CreatedAt], sp.[UpdatedAt]
      FROM [Commerce].[SupplierProducts] sp
      JOIN [Commerce].[Suppliers] s ON s.[Id] = sp.[SupplierId] AND s.[Code] = N''CJ''
      JOIN [Commerce].[Products] p ON p.[Id] = sp.[ProductId];
    ');
  END;

  IF OBJECT_ID(N'[dbo].[MostChosenProducts]', N'V') IS NULL
  BEGIN
    EXEC(N'
      CREATE VIEW [dbo].[MostChosenProducts] AS
      SELECT TOP (10) p.[LegacyProductId] AS [PID], p.[Name], p.[Description], v.[SellingPrice] AS [Price],
             img.[Url] AS [imageUrl], CONVERT(INT, COALESCE(SUM(oi.[Quantity]), 0)) AS [ChosenCount]
      FROM [Commerce].[Products] p
      LEFT JOIN [Commerce].[ProductVariants] v ON v.[Id] = p.[DefaultVariantId]
      LEFT JOIN [Commerce].[OrderItems] oi ON oi.[ProductId] = p.[Id]
      OUTER APPLY (SELECT TOP (1) i.[Url] FROM [Commerce].[ProductImages] i WHERE i.[ProductId] = p.[Id] ORDER BY i.[IsPrimary] DESC, i.[SortOrder]) img
      GROUP BY p.[LegacyProductId], p.[Name], p.[Description], v.[SellingPrice], img.[Url];
    ');
  END;

  IF NOT EXISTS (SELECT 1 FROM [dbo].[WeluxoMigrationHistory] WHERE [MigrationId] = N'001_weluxo_platform_upgrade')
  BEGIN
    INSERT INTO [dbo].[WeluxoMigrationHistory] ([MigrationId], [Description])
    VALUES (N'001_weluxo_platform_upgrade', N'Canonical Commerce, ERP, and CRM platform foundation with guarded legacy migration.');
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
