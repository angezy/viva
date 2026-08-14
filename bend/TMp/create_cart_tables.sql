-- Persistent cart schema for authenticated users and guest sessions.
SET NOCOUNT ON;

IF OBJECT_ID('[dbo].[cart]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[cart] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id NVARCHAR(128) NULL,
        session_id NVARCHAR(128) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_cart_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
    );
    CREATE UNIQUE INDEX UX_cart_user_id ON [dbo].[cart](user_id) WHERE user_id IS NOT NULL;
    CREATE UNIQUE INDEX UX_cart_session_id ON [dbo].[cart](session_id) WHERE session_id IS NOT NULL;
END;

IF OBJECT_ID('[dbo].[cart_items]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[cart_items] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        cart_id BIGINT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT(1),
        price DECIMAL(18,2) NOT NULL DEFAULT(0),
        variant NVARCHAR(500) NULL,
        image NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_cart_items_cart FOREIGN KEY (cart_id) REFERENCES [dbo].[cart](id) ON DELETE CASCADE,
        CONSTRAINT CK_cart_items_quantity CHECK (quantity >= 1)
    );
    CREATE UNIQUE INDEX UX_cart_items_product ON [dbo].[cart_items](cart_id, product_id);
END;

PRINT 'dbo.cart and dbo.cart_items are ready';
