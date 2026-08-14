-- Stores checkout and payment attempts for recovery, support, and analytics.
SET NOCOUNT ON;

IF OBJECT_ID('[dbo].[checkout_attempts]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[checkout_attempts] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        attempt_id NVARCHAR(120) NOT NULL UNIQUE,
        user_id NVARCHAR(128) NULL,
        cart_id NVARCHAR(128) NULL,
        customer_email NVARCHAR(255) NULL,
        status NVARCHAR(40) NOT NULL,
        payment_error NVARCHAR(1000) NULL,
        payment_id NVARCHAR(120) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NULL,
        completed_at DATETIME2 NULL
    );

    CREATE INDEX IX_checkout_attempts_user_id
        ON [dbo].[checkout_attempts](user_id, created_at DESC);
    CREATE INDEX IX_checkout_attempts_status
        ON [dbo].[checkout_attempts](status, created_at DESC);
END;

PRINT 'dbo.checkout_attempts is ready';
