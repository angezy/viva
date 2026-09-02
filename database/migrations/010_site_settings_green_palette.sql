-- Replace the original blue default palette with the current saved site palette.
-- Only the known original defaults are changed; customized site colors remain untouched.
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.DashboardSettings', N'U') IS NOT NULL
BEGIN
    UPDATE dbo.DashboardSettings
    SET SettingValue = CASE SettingKey
        WHEN N'primaryColor' THEN N'#FF6B35'
        WHEN N'primaryDarkColor' THEN N'#B94016'
        WHEN N'linkHoverColor' THEN N'#C94C1B'
        WHEN N'primaryLightColor' THEN N'#FFB38A'
        WHEN N'primarySoftColor' THEN N'#FFF0E8'
    END
    WHERE (SettingKey = N'primaryColor' AND SettingValue = N'#2563eb')
       OR (SettingKey = N'primaryDarkColor' AND SettingValue = N'#1746b2')
       OR (SettingKey = N'linkHoverColor' AND SettingValue = N'#1746b2')
       OR (SettingKey = N'primaryLightColor' AND SettingValue = N'#5b8def')
       OR (SettingKey = N'primarySoftColor' AND SettingValue = N'#eef4ff');
END;
