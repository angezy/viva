
-- Create footer_tbl with individual columns for each link and social
CREATE TABLE [dbo].[footer_tbl] (
  ID INT IDENTITY(1,1) PRIMARY KEY,
  logoText NVARCHAR(100) NOT NULL DEFAULT 'Viva Store',
  description NVARCHAR(255) NULL DEFAULT 'Best products, best prices.',
  homeLabel NVARCHAR(50) NULL DEFAULT 'Home',
  homeHref NVARCHAR(255) NULL DEFAULT '/',
  shopLabel NVARCHAR(50) NULL DEFAULT 'Shop',
  shopHref NVARCHAR(255) NULL DEFAULT '/shop',
  blogLabel NVARCHAR(50) NULL DEFAULT 'Blog',
  blogHref NVARCHAR(255) NULL DEFAULT '/blog',
  aboutusLabel NVARCHAR(50) NULL DEFAULT 'About Us',
  aboutusHref NVARCHAR(255) NULL DEFAULT '/aboutus',
  facebook NVARCHAR(255) NULL DEFAULT 'https://facebook.com/viva',
  twitter NVARCHAR(255) NULL DEFAULT 'https://twitter.com/viva',
  instagram NVARCHAR(255) NULL DEFAULT 'https://instagram.com/viva',
  linkedin NVARCHAR(255) NULL DEFAULT 'https://linkedin.com/company/viva'
);


-- Insert one row of data into footer_tbl
INSERT INTO [dbo].[footer_tbl] (
  logoText, description,
  homeLabel, homeHref,
  shopLabel, shopHref,
  blogLabel, blogHref,
  aboutusLabel, aboutusHref,
  facebook, twitter, instagram, linkedin
) VALUES (
  'Viva Store',
  'Best products, best prices.',
  'Home', '/',
  'Shop', '/shop',
  'Blog', '/blog',
  'About Us', '/aboutus',
  'https://facebook.com/viva',
  'https://twitter.com/viva',
  'https://instagram.com/viva',
  'https://linkedin.com/company/viva'
);
