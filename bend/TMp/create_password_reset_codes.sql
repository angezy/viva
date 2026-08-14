-- One-time customer password-reset codes and verified reset sessions.
-- The API also creates this table on demand for environments that do not run migrations automatically.
IF OBJECT_ID(N'dbo.password_reset_codes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.password_reset_codes (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserID INT NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        CodeHash NVARCHAR(64) NOT NULL,
        ResetTokenHash NVARCHAR(64) NULL,
        ExpiresAt DATETIME2(3) NOT NULL,
        Attempts INT NOT NULL CONSTRAINT DF_password_reset_codes_Attempts DEFAULT 0,
        VerifiedAt DATETIME2(3) NULL,
        UsedAt DATETIME2(3) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_password_reset_codes_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_password_reset_codes_Email_CreatedAt
        ON dbo.password_reset_codes (Email, CreatedAt DESC);
END
