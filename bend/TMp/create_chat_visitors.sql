-- Visitor identity collected before a customer starts live chat.
-- The API also creates this table on demand for environments without automatic migrations.
IF OBJECT_ID(N'dbo.chat_visitors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.chat_visitors (
        conversation_id NVARCHAR(80) NOT NULL PRIMARY KEY,
        customer_name NVARCHAR(200) NOT NULL,
        customer_email NVARCHAR(255) NOT NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_chat_visitors_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_chat_visitors_updated_at DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_chat_visitors_email ON dbo.chat_visitors (customer_email);
END
