-- Add Img and Email columns to dbo.Comments if they do not exist
IF NOT EXISTS (
	SELECT 1 FROM sys.columns
	WHERE Name = N'Img' AND Object_ID = Object_ID(N'dbo.Comments')
)
BEGIN
	ALTER TABLE dbo.Comments ADD Img NVARCHAR(MAX) NULL;
	PRINT 'Added Img column to dbo.Comments';
END
ELSE
BEGIN
	PRINT 'Img column already exists on dbo.Comments';
END

IF NOT EXISTS (
	SELECT 1 FROM sys.columns
	WHERE Name = N'Email' AND Object_ID = Object_ID(N'dbo.Comments')
)
BEGIN
	ALTER TABLE dbo.Comments ADD Email NVARCHAR(256) NULL;
	PRINT 'Added Email column to dbo.Comments';
END
ELSE
BEGIN
	PRINT 'Email column already exists on dbo.Comments';
END

