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
    (N'siteName', N'Weluxo'),
    (N'siteDescription', N'Weluxo Shop - Your partner in performance.'),
    (N'siteTagline', N'Move with intent'),
    (N'siteUrl', N'https://weluxo.com'),
    (N'siteKeywords', N'online shop, lifestyle products, performance gear'),
    (N'siteLogoUrl', N''),
    (N'siteFaviconUrl', N''),
    (N'siteOgImageUrl', N''),
    (N'fontFamily', N'system'),
    (N'customFontName', N''),
    (N'customFontUrl', N''),
    (N'customFontFormat', N'woff2'),
    (N'primaryColor', N'#2563eb'),
    (N'primaryDarkColor', N'#1746b2'),
    (N'linkHoverColor', N'#1746b2'),
    (N'primaryLightColor', N'#5b8def'),
    (N'primarySoftColor', N'#eef4ff'),
    (N'accentColor', N'#f28c28'),
    (N'accentDarkColor', N'#c96a0e'),
    (N'accentLightColor', N'#ffb15a'),
    (N'accentSoftColor', N'#fff4e5'),
    (N'backgroundColor', N'#fbf4e8'),
    (N'surfaceColor', N'#ffffff'),
    (N'surfaceMutedColor', N'#fffaf2'),
    (N'borderColor', N'#e7dfd3'),
    (N'textPrimaryColor', N'#2b2b2b'),
    (N'textSecondaryColor', N'#62656b'),
    (N'successColor', N'#2e8b57'),
    (N'warningColor', N'#f28c28'),
    (N'errorColor', N'#c94a4a'),
    (N'supportEmail', N'support@weluxo.com'),
    (N'supportPhone', N''),
    (N'supportHours', N'Support available within 24-48 hours'),
    (N'welcomePopupEnabled', N'true'),
    (N'welcomePopupEyebrow', N'NEW CUSTOMER WELCOME'),
    (N'welcomePopupTitle', N'Log in and get 10% off'),
    (N'welcomePopupDescription', N'Create your account or log in to unlock 10% off your first order.'),
    (N'welcomePopupButtonLabel', N'Log in & claim 10% off'),
    (N'welcomePopupCouponCode', N'WELCOME10'),
    (N'welcomePopupFinePrint', N'New customers only. One use per customer.');

INSERT INTO dbo.DashboardSettings (SettingKey, SettingValue)
SELECT d.SettingKey, d.SettingValue
FROM @Defaults d
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.DashboardSettings s WHERE s.SettingKey = d.SettingKey
);
