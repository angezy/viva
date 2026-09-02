-- Canonical storefront identity and SEO settings.
-- Run after dbo.DashboardSettings exists. The dashboard can also create/update
-- these keys automatically through /api/dashboard/settings.
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.DashboardSettings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DashboardSettings (
        SettingKey NVARCHAR(100) NOT NULL PRIMARY KEY,
        SettingValue NVARCHAR(MAX) NULL
    );
END;

DECLARE @Defaults TABLE (SettingKey NVARCHAR(100), SettingValue NVARCHAR(MAX));
INSERT INTO @Defaults (SettingKey, SettingValue) VALUES
    (N'siteName', N'Your Store'),
    (N'siteDescription', N'Your Store - Your online store.'),
    (N'siteTagline', N'Shop with confidence'),
    (N'siteUrl', N'http://localhost:3000'),
    (N'siteKeywords', N'online shop, products, ecommerce'),
    (N'siteLogoUrl', N''),
    (N'siteFaviconUrl', N''),
    (N'siteOgImageUrl', N''),
    (N'fontFamily', N'system'),
    (N'customFontName', N''),
    (N'customFontUrl', N''),
    (N'customFontFormat', N'woff2'),
    (N'customFontVariable', N'false'),
    (N'customFontId', N''),
    (N'customFonts', N'[]'),
    (N'primaryColor', N'#FF6B35'),
    (N'primaryDarkColor', N'#B94016'),
    (N'linkHoverColor', N'#C94C1B'),
    (N'primaryLightColor', N'#FFB38A'),
    (N'primarySoftColor', N'#FFF0E8'),
    (N'accentColor', N'#315C78'),
    (N'accentDarkColor', N'#24465C'),
    (N'accentLightColor', N'#A9C5D6'),
    (N'accentSoftColor', N'#EDF4F7'),
    (N'backgroundColor', N'#F7F3EC'),
    (N'surfaceColor', N'#FFFEFC'),
    (N'surfaceMutedColor', N'#EEEAE3'),
    (N'borderColor', N'#D8D2C8'),
    (N'textPrimaryColor', N'#242321'),
    (N'textSecondaryColor', N'#68635D'),
    (N'successColor', N'#287A65'),
    (N'warningColor', N'#f28c28'),
    (N'errorColor', N'#c94a4a'),
    (N'supportEmail', N'support@example.com'),
    (N'supportPhone', N''),
    (N'supportHours', N'Support available within 24-48 hours'),
    (N'welcomePopupEnabled', N'false'),
    (N'welcomePopupEyebrow', N'NEW CUSTOMER WELCOME'),
    (N'welcomePopupTitle', N'Welcome to our store'),
    (N'welcomePopupDescription', N'Configure a welcome offer from the owner dashboard when you are ready.'),
    (N'welcomePopupButtonLabel', N'Start shopping'),
    (N'welcomePopupCouponCode', N''),
    (N'welcomePopupFinePrint', N'');

INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue)
SELECT d.SettingKey, d.SettingValue
FROM @Defaults d
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.DashboardSettings s WHERE s.SettingKey = d.SettingKey
);
