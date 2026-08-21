-- =====================================================
-- Weluxo default data and runtime compatibility seed
-- SQL Server
--
-- Run scripts/create_database.sql first, then run this file.
-- This script is safe to run repeatedly: it only creates missing supporting
-- tables/columns and inserts records when the matching data does not exist.
-- =====================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.Products_tbl', N'U') IS NULL
   OR OBJECT_ID(N'dbo.User_tbl', N'U') IS NULL
   OR OBJECT_ID(N'dbo.header_tbl', N'U') IS NULL
   OR OBJECT_ID(N'dbo.head_tbl', N'U') IS NULL
   OR OBJECT_ID(N'dbo.footer_tbl', N'U') IS NULL
BEGIN
    THROW 50000, 'Run scripts/create_database.sql in the target database before running this seed script.', 1;
END;
GO

BEGIN TRANSACTION;

-- These columns are read by the dashboard profile and user-management APIs.
IF COL_LENGTH(N'dbo.User_tbl', N'FullName') IS NULL
    ALTER TABLE dbo.User_tbl ADD FullName nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.User_tbl', N'AvatarUrl') IS NULL
    ALTER TABLE dbo.User_tbl ADD AvatarUrl nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.User_tbl', N'Bio') IS NULL
    ALTER TABLE dbo.User_tbl ADD Bio nvarchar(max) NULL;
IF COL_LENGTH(N'dbo.User_tbl', N'Country') IS NULL
    ALTER TABLE dbo.User_tbl ADD Country nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.User_tbl', N'State') IS NULL
    ALTER TABLE dbo.User_tbl ADD State nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.User_tbl', N'City') IS NULL
    ALTER TABLE dbo.User_tbl ADD City nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.User_tbl', N'Zip') IS NULL
    ALTER TABLE dbo.User_tbl ADD Zip nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.User_tbl', N'Address') IS NULL
    ALTER TABLE dbo.User_tbl ADD Address nvarchar(255) NULL;
IF COL_LENGTH(N'dbo.User_tbl', N'SignupIP') IS NULL
    ALTER TABLE dbo.User_tbl ADD SignupIP nvarchar(45) NULL;
-- The frontend reads ImgUrl while the original schema calls this column Img.
IF COL_LENGTH(N'dbo.head_tbl', N'ImgUrl') IS NULL
BEGIN
    EXEC sys.sp_executesql
        N'ALTER TABLE dbo.head_tbl ADD ImgUrl nvarchar(max) NULL;';
END;

EXEC sys.sp_executesql
    N'UPDATE dbo.head_tbl
      SET ImgUrl = Img
      WHERE ImgUrl IS NULL;';
GO

-- These tables are used by the dashboard routes but are not created by the
-- original schema script.
IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications (
        NotificationId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
        Title nvarchar(200) NOT NULL,
        Message nvarchar(max) NOT NULL,
        CreatedAt datetime NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT (GETDATE()),
        IsRead bit NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT (0),
        IsVisible bit NOT NULL CONSTRAINT DF_Notifications_IsVisible DEFAULT (1)
    );
END;

IF OBJECT_ID(N'dbo.DashboardSettings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DashboardSettings (
        SettingId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_DashboardSettings PRIMARY KEY,
        SettingKey nvarchar(100) NOT NULL,
        SettingValue nvarchar(max) NULL,
        CONSTRAINT UQ_DashboardSettings_SettingKey UNIQUE (SettingKey)
    );
END;

IF OBJECT_ID(N'dbo.HomeContent_tbl', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HomeContent_tbl (
        HomeContentId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_HomeContent_tbl PRIMARY KEY,
        Title nvarchar(200) NOT NULL,
        Subtitle nvarchar(max) NULL,
        ImageUrl nvarchar(500) NULL,
        ButtonText nvarchar(100) NULL,
        ButtonUrl nvarchar(255) NULL,
        CreatedAt datetime NOT NULL CONSTRAINT DF_HomeContent_CreatedAt DEFAULT (GETDATE())
    );
END;
GO

-- Site shell ---------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.header_tbl)
BEGIN
    INSERT INTO dbo.header_tbl (LogoUrl, Name, Home, Blog, Shop, AboutUs)
    VALUES (N'/fend/src/app/uploads/[...path]/favicon.ico', N'Weluxo', N'Home', N'Blog', N'Shop', N'About Us');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.head_tbl)
BEGIN
    INSERT INTO dbo.head_tbl (Title, Text, Img, ImgUrl, Button, ButtonUrl)
    VALUES (
        N'Train smarter. Live stronger.',
        N'Performance essentials, selected for your next level.',
        N'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1600&q=80',
        N'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1600&q=80',
        N'Shop now',
        N'/shop'
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.footer_tbl)
BEGIN
    INSERT INTO dbo.footer_tbl (
        logoText, description, homeLabel, homeHref, shopLabel, shopHref,
        blogLabel, blogHref, aboutusLabel, aboutusHref, facebook, instagram
    )
    VALUES (
        N'Weluxo', N'Performance gear for everyday progress.',
        N'Home', N'/', N'Shop', N'/shop', N'Blog', N'/blog', N'About Us', N'/aboutus',
        N'https://www.facebook.com/', N'https://www.instagram.com/'
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.HomeContent_tbl)
BEGIN
    INSERT INTO dbo.HomeContent_tbl (Title, Subtitle, ImageUrl, ButtonText, ButtonUrl)
    VALUES (
        N'Your partner in performance',
        N'Quality training gear and practical programs for consistent progress.',
        N'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80',
        N'Shop the collection', N'/shop'
    );
END;
GO

-- Store products -----------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.Products_tbl WHERE Name = N'Weluxo Training Mat')
    INSERT INTO dbo.Products_tbl (Brand, Name, IMG, Category, Colort, Stock, Price, Description, Alt, ChosenCount)
    VALUES (N'Weluxo', N'Weluxo Training Mat', N'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80', N'Training', N'Black', 25, 49.99, N'Comfortable, durable support for every session.', N'Black training mat', 12);

IF NOT EXISTS (SELECT 1 FROM dbo.Products_tbl WHERE Name = N'Power Grip Set')
    INSERT INTO dbo.Products_tbl (Brand, Name, IMG, Category, Colort, Stock, Price, Description, Alt, ChosenCount)
    VALUES (N'Weluxo', N'Power Grip Set', N'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=900&q=80', N'Strength', N'Blue', 40, 34.99, N'Secure, adjustable grips for strength training.', N'Blue power grips', 9);

IF NOT EXISTS (SELECT 1 FROM dbo.Products_tbl WHERE Name = N'Recovery Roller')
    INSERT INTO dbo.Products_tbl (Brand, Name, IMG, Category, Colort, Stock, Price, Description, Alt, ChosenCount)
    VALUES (N'Weluxo', N'Recovery Roller', N'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80', N'Recovery', N'Charcoal', 30, 29.99, N'Firm foam roller for post-workout recovery.', N'Charcoal foam roller', 7);

DECLARE @TrainingMatId int = (SELECT TOP (1) PID FROM dbo.Products_tbl WHERE Name = N'Weluxo Training Mat' ORDER BY PID);
IF @TrainingMatId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.ProductAddress_tbl WHERE ProductId = @TrainingMatId)
        INSERT INTO dbo.ProductAddress_tbl (ProductId, AddressLine) VALUES (@TrainingMatId, N'Weluxo distribution center');
    IF NOT EXISTS (SELECT 1 FROM dbo.ProductImages_tbl WHERE ProductId = @TrainingMatId)
        INSERT INTO dbo.ProductImages_tbl (ProductId, ImagePath)
        VALUES (@TrainingMatId, N'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80');
END;
GO

-- Dashboard and social proof ----------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'emailNotifications')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'emailNotifications', N'true');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'darkMode')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'darkMode', N'false');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'siteName')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'siteName', N'Weluxo');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'siteDescription')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'siteDescription', N'Weluxo Shop - Your partner in performance.');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'siteTagline')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'siteTagline', N'Move with intent');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'siteUrl')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'siteUrl', N'https://weluxo.com');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'siteKeywords')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'siteKeywords', N'online shop, lifestyle products, performance gear');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'primaryColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'primaryColor', N'#2563eb');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'primaryDarkColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'primaryDarkColor', N'#1746b2');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'linkHoverColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'linkHoverColor', N'#1746b2');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'primaryLightColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'primaryLightColor', N'#5b8def');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'primarySoftColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'primarySoftColor', N'#eef4ff');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'accentColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'accentColor', N'#f28c28');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'accentDarkColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'accentDarkColor', N'#c96a0e');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'accentLightColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'accentLightColor', N'#ffb15a');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'accentSoftColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'accentSoftColor', N'#fff4e5');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'backgroundColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'backgroundColor', N'#fbf4e8');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'surfaceColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'surfaceColor', N'#ffffff');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'surfaceMutedColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'surfaceMutedColor', N'#fffaf2');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'borderColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'borderColor', N'#e7dfd3');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'textPrimaryColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'textPrimaryColor', N'#2b2b2b');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'textSecondaryColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'textSecondaryColor', N'#62656b');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'successColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'successColor', N'#2e8b57');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'warningColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'warningColor', N'#f28c28');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'errorColor')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'errorColor', N'#c94a4a');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'supportEmail')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'supportEmail', N'support@weluxo.com');
IF NOT EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE SettingKey = N'supportHours')
    INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue) VALUES (N'supportHours', N'Support available within 24-48 hours');

IF NOT EXISTS (SELECT 1 FROM dbo.Notifications)
    INSERT INTO dbo.Notifications (Title, Message, IsRead, IsVisible)
    VALUES (N'Welcome to Weluxo', N'Your store has been seeded with starter content and products.', 0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Comments WHERE Name = N'Weluxo Team' AND Text = N'Welcome to Weluxo. We are glad you are here!')
    INSERT INTO dbo.Comments (Name, Text, Email, ShowComment)
    VALUES (N'Weluxo Team', N'Welcome to Weluxo. We are glad you are here!', N'support@example.com', 1);
GO

-- Initial administrator ----------------------------------------------------
-- Sign in once with admin@weluxo.local / ChangeMe123! and immediately change
-- the password or remove this account. The stored value is a bcrypt hash.
IF NOT EXISTS (SELECT 1 FROM dbo.User_tbl WHERE Email = N'admin@weluxo.local')
BEGIN
    INSERT INTO dbo.User_tbl (Username, Email, PasswordHash, Role, FullName, Bio)
    VALUES (
        N'admin', N'admin@weluxo.local',
        N'$2b$10$XfiojspZW62Zz24YgCEz8utkc4k0exUgRDFwbRnDzwu/PvbQyLEVO',
        N'admin', N'Weluxo Administrator', N'Initial administrator account'
    );
END;
GO

COMMIT TRANSACTION;
GO

PRINT 'Weluxo default data has been seeded successfully.';
