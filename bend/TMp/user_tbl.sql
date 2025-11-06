CREATE TABLE User_tbl (
    UserID INT IDENTITY(1,1) PRIMARY KEY,  -- auto increment ID
    Username NVARCHAR(100) NOT NULL UNIQUE,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,   -- store hashed password, not plain text
    Role NVARCHAR(50) DEFAULT 'user',
    CreatedAt DATETIME DEFAULT GETDATE(),
    LastLogin DATETIME NULL,
    LastIP NVARCHAR(45) NULL              -- IPv4 or IPv6
);
