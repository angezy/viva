/*
  RBAC foundation for reusable store installations.
  This migration only creates reference data and compatibility constraints. It
  never promotes an existing user and never copies business data.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF SCHEMA_ID(N'Security') IS NULL
    EXEC(N'CREATE SCHEMA [Security] AUTHORIZATION [dbo]');

  IF OBJECT_ID(N'[Security].[Roles]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Security].[Roles] (
      [RoleCode] NVARCHAR(50) NOT NULL,
      [DisplayName] NVARCHAR(100) NOT NULL,
      [IsSystem] BIT NOT NULL CONSTRAINT [DF_Security_Roles_IsSystem] DEFAULT (1),
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Security_Roles_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Security_Roles] PRIMARY KEY CLUSTERED ([RoleCode])
    );
  END;

  IF OBJECT_ID(N'[Security].[Permissions]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Security].[Permissions] (
      [PermissionCode] NVARCHAR(100) NOT NULL,
      [Description] NVARCHAR(300) NOT NULL,
      [CreatedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Security_Permissions_CreatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Security_Permissions] PRIMARY KEY CLUSTERED ([PermissionCode])
    );
  END;

  IF OBJECT_ID(N'[Security].[RolePermissions]', N'U') IS NULL
  BEGIN
    CREATE TABLE [Security].[RolePermissions] (
      [RoleCode] NVARCHAR(50) NOT NULL,
      [PermissionCode] NVARCHAR(100) NOT NULL,
      [GrantedAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Security_RolePermissions_GrantedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_Security_RolePermissions] PRIMARY KEY CLUSTERED ([RoleCode], [PermissionCode]),
      CONSTRAINT [FK_Security_RolePermissions_Role] FOREIGN KEY ([RoleCode]) REFERENCES [Security].[Roles]([RoleCode]) ON DELETE CASCADE,
      CONSTRAINT [FK_Security_RolePermissions_Permission] FOREIGN KEY ([PermissionCode]) REFERENCES [Security].[Permissions]([PermissionCode]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_Security_RolePermissions_Permission]
      ON [Security].[RolePermissions] ([PermissionCode], [RoleCode]);
  END;

  INSERT INTO [Security].[Roles] ([RoleCode], [DisplayName])
  SELECT v.[RoleCode], v.[DisplayName]
  FROM (VALUES
    (N'owner', N'Owner'),
    (N'admin', N'Store operator'),
    (N'customer', N'Customer')
  ) v([RoleCode], [DisplayName])
  WHERE NOT EXISTS (SELECT 1 FROM [Security].[Roles] r WHERE r.[RoleCode] = v.[RoleCode]);

  INSERT INTO [Security].[Permissions] ([PermissionCode], [Description])
  SELECT v.[PermissionCode], v.[Description]
  FROM (VALUES
    (N'dashboard.view', N'Open the staff dashboard shell and operational landing page'),
    (N'profile.read', N'Read staff profile details'),
    (N'notifications.manage', N'Manage internal dashboard notifications'),
    (N'analytics.read', N'Read cross-store analytics and financial dashboard metrics'),
    (N'orders.read', N'Read orders and fulfillment details'),
    (N'orders.update', N'Update permitted operational order statuses'),
    (N'tickets.read', N'Read the staff support queue and ticket history'),
    (N'tickets.reply', N'Reply to customers and add permitted ticket notes'),
    (N'tickets.update', N'Update permitted ticket status and assignment fields'),
    (N'users.read', N'Read customer profiles needed for support and order handling'),
    (N'products.read', N'Read the product catalog'),
    (N'products.manage', N'Create, update, and delete products'),
    (N'inventory.manage', N'Manage inventory quantities and adjustments'),
    (N'coupons.manage', N'Manage promotions and coupons'),
    (N'marketing.read', N'Read marketing campaigns and content'),
    (N'marketing.manage', N'Manage marketing campaigns and content'),
    (N'settings.manage', N'Manage store settings and branding'),
    (N'staff.manage', N'Create and manage staff accounts'),
    (N'roles.manage', N'Manage roles and permission assignments'),
    (N'finance.read', N'Read financial transactions, invoices, and refunds'),
    (N'payments.manage', N'Manage payment configuration and payment actions'),
    (N'refunds.manage', N'Manage refunds and inventory refund decisions'),
    (N'shipping.manage', N'Manage shipping configuration and fulfillment'),
    (N'integrations.manage', N'Manage supplier and external integrations'),
    (N'suppliers.read', N'Read supplier operations'),
    (N'loyalty.read', N'Read loyalty program records'),
    (N'reviews.manage', N'Moderate and feature customer reviews'),
    (N'content.manage', N'Manage storefront content'),
    (N'audit.read', N'Read security and audit logs')
  ) v([PermissionCode], [Description])
  WHERE NOT EXISTS (SELECT 1 FROM [Security].[Permissions] p WHERE p.[PermissionCode] = v.[PermissionCode]);

  -- Owner receives every currently defined permission. The application also
  -- treats owner as the future-permission default until explicitly restricted.
  INSERT INTO [Security].[RolePermissions] ([RoleCode], [PermissionCode])
  SELECT N'owner', p.[PermissionCode]
  FROM [Security].[Permissions] p
  WHERE NOT EXISTS (
    SELECT 1 FROM [Security].[RolePermissions] rp
    WHERE rp.[RoleCode] = N'owner' AND rp.[PermissionCode] = p.[PermissionCode]
  );

  INSERT INTO [Security].[RolePermissions] ([RoleCode], [PermissionCode])
  SELECT N'admin', v.[PermissionCode]
  FROM (VALUES
    (N'dashboard.view'), (N'orders.read'), (N'orders.update'),
    (N'tickets.read'), (N'tickets.reply'), (N'tickets.update'), (N'users.read')
  ) v([PermissionCode])
  WHERE NOT EXISTS (
    SELECT 1 FROM [Security].[RolePermissions] rp
    WHERE rp.[RoleCode] = N'admin' AND rp.[PermissionCode] = v.[PermissionCode]
  );

  IF OBJECT_ID(N'[Security].[AuthSessions]', N'U') IS NOT NULL
  BEGIN
    IF EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE [name] = N'CK_AuthSessions_Role'
        AND [parent_object_id] = OBJECT_ID(N'[Security].[AuthSessions]')
    )
      ALTER TABLE [Security].[AuthSessions] DROP CONSTRAINT [CK_AuthSessions_Role];

    IF NOT EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE [name] = N'CK_AuthSessions_Role'
        AND [parent_object_id] = OBJECT_ID(N'[Security].[AuthSessions]')
    )
      ALTER TABLE [Security].[AuthSessions] WITH CHECK ADD CONSTRAINT [CK_AuthSessions_Role]
        CHECK ([session_role] IN (N'user', N'customer', N'admin', N'owner'));
  END;

  IF OBJECT_ID(N'[dbo].[WeluxoMigrationHistory]', N'U') IS NOT NULL
    IF NOT EXISTS (SELECT 1 FROM [dbo].[WeluxoMigrationHistory] WHERE [MigrationId] = N'020_rbac_roles_permissions')
      INSERT INTO [dbo].[WeluxoMigrationHistory] ([MigrationId], [Description])
      VALUES (N'020_rbac_roles_permissions', N'Centralized owner, admin, and customer RBAC reference data.');

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
