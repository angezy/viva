-- SQL script to create dbo.footer_tbl and insert a footer row

CREATE TABLE [dbo].[footer_tbl] (
    [ID] INT IDENTITY(1,1) PRIMARY KEY,
    [Text] NVARCHAR(255) NOT NULL,
    [Year] INT NOT NULL
);

-- Insert a sample footer row
INSERT INTO [dbo].[footer_tbl] ([Text], [Year])
VALUES (
    '© Viva',
    2025
);
