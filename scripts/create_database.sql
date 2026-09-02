-- =====================================================
-- Legacy foundation schema for a selected target database.
-- The caller must select the target database through the connection or
-- sqlcmd -d. This file never creates, selects, restores, or copies a database.
-- Tables + Identity PKs + Defaults + Foreign Keys + Views
-- =====================================================

-- =====================================================
-- Tables
-- =====================================================

CREATE TABLE [dbo].[Products_tbl] (
    [Brand] nvarchar(100) NOT NULL,
    [Name] nvarchar(255) NOT NULL,
    [IMG] nvarchar(500) NOT NULL,
    [Category] nvarchar(100) NOT NULL,
    [Colort] nvarchar(50) NULL,
    [Stock] int NOT NULL CONSTRAINT [DF_Products_Stock] DEFAULT (0),
    [PID] int IDENTITY(1,1) NOT NULL,
    [Price] decimal(10,2) NULL CONSTRAINT [DF_Products_Price] DEFAULT (0),
    [Description] nvarchar(max) NULL,
    [Alt] nvarchar(255) NULL,
    [ChosenCount] int NOT NULL CONSTRAINT [DF_Products_ChosenCount] DEFAULT (0),

    CONSTRAINT [PK_Products_tbl] PRIMARY KEY ([PID])
);
GO

CREATE TABLE [dbo].[CjImportedProducts_tbl] (
    [Id] int IDENTITY(1,1) NOT NULL,
    [Pid] nvarchar(120) NOT NULL,
    [ProductId] int NOT NULL,
    [Price] decimal(18,2) NOT NULL CONSTRAINT [DF_CjImportedProducts_Price] DEFAULT (0),
    [RawJson] nvarchar(max) NULL,
    [CreatedAt] datetime NULL CONSTRAINT [DF_CjImportedProducts_CreatedAt] DEFAULT (GETDATE()),
    [UpdatedAt] datetime NULL CONSTRAINT [DF_CjImportedProducts_UpdatedAt] DEFAULT (GETDATE()),

    CONSTRAINT [PK_CjImportedProducts_tbl] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [dbo].[Comments] (
    [CommentId] int IDENTITY(1,1) NOT NULL,
    [Name] nvarchar(100) NOT NULL,
    [Text] nvarchar(max) NOT NULL,
    [ShowComment] bit NOT NULL CONSTRAINT [DF_Comments_ShowComment] DEFAULT (0),
    [CreatedAt] datetime NULL CONSTRAINT [DF_Comments_CreatedAt] DEFAULT (GETDATE()),
    [Img] nvarchar(max) NULL,
    [Email] nvarchar(256) NULL,

    CONSTRAINT [PK_Comments] PRIMARY KEY ([CommentId])
);
GO

CREATE TABLE [dbo].[footer_tbl] (
    [ID] int IDENTITY(1,1) NOT NULL,
    [logoText] nvarchar(100) NOT NULL,
    [description] nvarchar(255) NULL,
    [homeLabel] nvarchar(50) NULL CONSTRAINT [DF_footer_homeLabel] DEFAULT (N'Home'),
    [homeHref] nvarchar(255) NULL CONSTRAINT [DF_footer_homeHref] DEFAULT (N'/'),
    [shopLabel] nvarchar(50) NULL CONSTRAINT [DF_footer_shopLabel] DEFAULT (N'Shop'),
    [shopHref] nvarchar(255) NULL CONSTRAINT [DF_footer_shopHref] DEFAULT (N'/shop'),
    [blogLabel] nvarchar(50) NULL CONSTRAINT [DF_footer_blogLabel] DEFAULT (N'Blog'),
    [blogHref] nvarchar(255) NULL CONSTRAINT [DF_footer_blogHref] DEFAULT (N'/blog'),
    [aboutusLabel] nvarchar(50) NULL CONSTRAINT [DF_footer_aboutusLabel] DEFAULT (N'About Us'),
    [aboutusHref] nvarchar(255) NULL CONSTRAINT [DF_footer_aboutusHref] DEFAULT (N'/about-us'),
    [facebook] nvarchar(255) NULL,
    [twitter] nvarchar(255) NULL,
    [instagram] nvarchar(255) NULL,
    [linkedin] nvarchar(255) NULL,

    CONSTRAINT [PK_footer_tbl] PRIMARY KEY ([ID])
);
GO

CREATE TABLE [dbo].[head_tbl] (
    [HeadId] int IDENTITY(1,1) NOT NULL,
    [Title] nvarchar(100) NOT NULL,
    [Text] nvarchar(max) NOT NULL,
    [Img] nvarchar(max) NOT NULL,
    [Button] nvarchar(max) NOT NULL CONSTRAINT [DF_head_Button] DEFAULT (N'Shop Now'),
    [ButtonUrl] nvarchar(max) NOT NULL CONSTRAINT [DF_head_ButtonUrl] DEFAULT (N'/shop'),

    CONSTRAINT [PK_head_tbl] PRIMARY KEY ([HeadId])
);
GO

CREATE TABLE [dbo].[header_tbl] (
    [ID] int IDENTITY(1,1) NOT NULL,
    [LogoUrl] nvarchar(255) NOT NULL,
    [Name] nvarchar(100) NOT NULL,
    [Home] nvarchar(50) NOT NULL CONSTRAINT [DF_header_Home] DEFAULT (N'Home'),
    [Blog] nvarchar(50) NOT NULL CONSTRAINT [DF_header_Blog] DEFAULT (N'Blog'),
    [Shop] nvarchar(50) NOT NULL CONSTRAINT [DF_header_Shop] DEFAULT (N'Shop'),
    [AboutUs] nvarchar(50) NOT NULL CONSTRAINT [DF_header_AboutUs] DEFAULT (N'About Us'),

    CONSTRAINT [PK_header_tbl] PRIMARY KEY ([ID])
);
GO

CREATE TABLE [dbo].[Orders_tbl] (
    [OrderId] nvarchar(64) NOT NULL,
    [UserId] nvarchar(64) NOT NULL,
    [Status] nvarchar(50) NOT NULL CONSTRAINT [DF_Orders_Status] DEFAULT (N'pending'),
    [Total] decimal(18,2) NOT NULL CONSTRAINT [DF_Orders_Total] DEFAULT (0),
    [Items] nvarchar(max) NOT NULL,
    [PlacedAt] datetime NOT NULL CONSTRAINT [DF_Orders_PlacedAt] DEFAULT (GETDATE()),
    [StripeSessionId] nvarchar(255) NULL,
    [StripePaymentIntentId] nvarchar(255) NULL,
    [Currency] nvarchar(10) NULL CONSTRAINT [DF_Orders_Currency] DEFAULT (N'USD'),
    [AmountPaid] decimal(18,2) NULL CONSTRAINT [DF_Orders_AmountPaid] DEFAULT (0),
    [PaidAt] datetime NULL,
    [FulfillmentProvider] nvarchar(50) NULL,
    [FulfillmentOrderId] nvarchar(255) NULL,
    [FulfillmentStatus] nvarchar(80) NULL CONSTRAINT [DF_Orders_FulfillmentStatus] DEFAULT (N'pending'),
    [TrackingNumber] nvarchar(255) NULL,
    [TrackingCarrier] nvarchar(255) NULL,
    [TrackingUpdatedAt] datetime NULL,
    [ShippingJson] nvarchar(max) NULL,
    [CjLogisticName] nvarchar(255) NULL,
    [CjFromCountryCode] nvarchar(10) NULL,

    CONSTRAINT [PK_Orders_tbl] PRIMARY KEY ([OrderId])
);
GO

CREATE TABLE [dbo].[ProductAddress_tbl] (
    [AddressId] int IDENTITY(1,1) NOT NULL,
    [ProductId] int NOT NULL,
    [AddressLine] nvarchar(255) NOT NULL,
    [CreatedAt] datetime NULL CONSTRAINT [DF_ProductAddress_CreatedAt] DEFAULT (GETDATE()),

    CONSTRAINT [PK_ProductAddress_tbl] PRIMARY KEY ([AddressId])
);
GO

CREATE TABLE [dbo].[ProductImages_tbl] (
    [ImageId] int IDENTITY(1,1) NOT NULL,
    [ProductId] int NOT NULL,
    [ImagePath] nvarchar(500) NOT NULL,
    [CreatedAt] datetime NULL CONSTRAINT [DF_ProductImages_CreatedAt] DEFAULT (GETDATE()),

    CONSTRAINT [PK_ProductImages_tbl] PRIMARY KEY ([ImageId])
);
GO

CREATE TABLE [dbo].[ProductVideos_tbl] (
    [VideoId] int IDENTITY(1,1) NOT NULL,
    [ProductId] int NOT NULL,
    [VideoUrl] nvarchar(500) NOT NULL,
    [CreatedAt] datetime NULL CONSTRAINT [DF_ProductVideos_CreatedAt] DEFAULT (GETDATE()),

    CONSTRAINT [PK_ProductVideos_tbl] PRIMARY KEY ([VideoId])
);
GO

CREATE TABLE [dbo].[User_tbl] (
    [UserID] int IDENTITY(1,1) NOT NULL,
    [Username] nvarchar(100) NOT NULL,
    [Email] nvarchar(255) NOT NULL,
    [PasswordHash] nvarchar(255) NOT NULL,
    [Role] nvarchar(50) NULL CONSTRAINT [DF_User_Role] DEFAULT (N'customer'),
    [CreatedAt] datetime NULL CONSTRAINT [DF_User_CreatedAt] DEFAULT (GETDATE()),
    [LastLogin] datetime NULL,
    [LastIP] nvarchar(45) NULL,

    CONSTRAINT [PK_User_tbl] PRIMARY KEY ([UserID])
);
GO

-- =====================================================
-- Foreign Keys
-- =====================================================

ALTER TABLE [dbo].[CjImportedProducts_tbl]
ADD CONSTRAINT [FK_CjImportedProducts_Products]
FOREIGN KEY ([ProductId])
REFERENCES [dbo].[Products_tbl]([PID]);
GO

ALTER TABLE [dbo].[ProductAddress_tbl]
ADD CONSTRAINT [FK_ProductAddress_Products]
FOREIGN KEY ([ProductId])
REFERENCES [dbo].[Products_tbl]([PID]);
GO

ALTER TABLE [dbo].[ProductImages_tbl]
ADD CONSTRAINT [FK_ProductImages_Products]
FOREIGN KEY ([ProductId])
REFERENCES [dbo].[Products_tbl]([PID]);
GO

ALTER TABLE [dbo].[ProductVideos_tbl]
ADD CONSTRAINT [FK_ProductVideos_Products]
FOREIGN KEY ([ProductId])
REFERENCES [dbo].[Products_tbl]([PID]);
GO

-- =====================================================
-- Views
-- =====================================================

CREATE VIEW [dbo].[homePage_view]
AS
SELECT
    dbo.header_tbl.LogoUrl,
    dbo.header_tbl.Name,
    dbo.header_tbl.Home,
    dbo.header_tbl.Blog,
    dbo.header_tbl.Shop,
    dbo.header_tbl.AboutUs,

    dbo.head_tbl.Title,
    dbo.head_tbl.Text,
    dbo.head_tbl.Img,
    dbo.head_tbl.Button,
    dbo.head_tbl.ButtonUrl,

    dbo.footer_tbl.logoText,
    dbo.footer_tbl.description,
    dbo.footer_tbl.homeLabel,
    dbo.footer_tbl.homeHref,
    dbo.footer_tbl.shopLabel,
    dbo.footer_tbl.shopHref,
    dbo.footer_tbl.blogLabel,
    dbo.footer_tbl.blogHref,
    dbo.footer_tbl.aboutusLabel,
    dbo.footer_tbl.aboutusHref,
    dbo.footer_tbl.facebook,
    dbo.footer_tbl.twitter,
    dbo.footer_tbl.instagram,
    dbo.footer_tbl.linkedin
FROM dbo.header_tbl
CROSS JOIN dbo.head_tbl
CROSS JOIN dbo.footer_tbl;
GO

CREATE VIEW [dbo].[MostChosenProducts]
AS
SELECT TOP 10
    PID,
    Name,
    Description,
    Price,
    IMG AS imageUrl,
    ChosenCount
FROM dbo.Products_tbl
ORDER BY ChosenCount DESC;
GO
