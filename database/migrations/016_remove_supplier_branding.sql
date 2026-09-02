/* Replace legacy supplier display names with neutral storefront labels. */
IF OBJECT_ID(N'[Commerce].[Suppliers]', N'U') IS NOT NULL
   AND COL_LENGTH(N'Commerce.Suppliers', N'Code') IS NOT NULL
   AND COL_LENGTH(N'Commerce.Suppliers', N'Name') IS NOT NULL
BEGIN
  UPDATE [Commerce].[Suppliers]
  SET [Name] = N'Fulfillment Partner'
  WHERE [Code] = N'CJ'
    AND LOWER(REPLACE(LTRIM(RTRIM([Name])), N' ', N'')) = N'cjdropshipping';
END;

IF OBJECT_ID(N'[dbo].[Products_tbl]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Products_tbl', N'Brand') IS NOT NULL
BEGIN
  UPDATE [dbo].[Products_tbl]
  SET [Brand] = N'Weluxo'
  WHERE LOWER(REPLACE(LTRIM(RTRIM([Brand])), N' ', N'')) = N'cjdropshipping';
END;
