CREATE TABLE head_tbl (
  HeadId INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(100) NOT NULL,
  Text NVARCHAR(MAX) NOT NULL,
  Img NVARCHAR(MAX) NOT NULL,
  Button NVARCHAR(MAX) NOT NULL,
  ButtonUrl NVARCHAR(MAX) NOT NULL
);

-- Insert two sample headers
INSERT INTO head_tbl (Title, Text, Img, Button, ButtonUrl)
VALUES 
  (N'Nick', N'This is the first header!', N'header1.jpg', N'Learn More', N'https://example.com/header1'),
  (N'Parmis', N'This is the second header!', N'header2.jpg', N'Get Started', N'https://example.com/header2');