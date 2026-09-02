/* Customer account profile, communication preferences, and reusable addresses. */
IF OBJECT_ID(N'dbo.CustomerAccountProfile', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CustomerAccountProfile (
    UserID INT NOT NULL CONSTRAINT PK_CustomerAccountProfile PRIMARY KEY,
    Phone NVARCHAR(40) NULL,
    EmailMarketing BIT NOT NULL CONSTRAINT DF_CustomerAccountProfile_EmailMarketing DEFAULT (0),
    SMSMarketing BIT NOT NULL CONSTRAINT DF_CustomerAccountProfile_SMSMarketing DEFAULT (0),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_CustomerAccountProfile_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.CustomerAccountAddresses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CustomerAccountAddresses (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_CustomerAccountAddresses_Id DEFAULT NEWSEQUENTIALID(),
    UserID INT NOT NULL,
    AddressType NVARCHAR(20) NOT NULL,
    Label NVARCHAR(80) NULL,
    FirstName NVARCHAR(120) NOT NULL,
    LastName NVARCHAR(120) NOT NULL,
    Company NVARCHAR(200) NULL,
    Phone NVARCHAR(40) NULL,
    AddressLine1 NVARCHAR(255) NOT NULL,
    AddressLine2 NVARCHAR(255) NULL,
    City NVARCHAR(120) NOT NULL,
    StateProvince NVARCHAR(120) NULL,
    PostalCode NVARCHAR(30) NOT NULL,
    Country NVARCHAR(100) NOT NULL,
    IsDefault BIT NOT NULL CONSTRAINT DF_CustomerAccountAddresses_IsDefault DEFAULT (0),
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_CustomerAccountAddresses_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_CustomerAccountAddresses_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_CustomerAccountAddresses PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT CK_CustomerAccountAddresses_Type CHECK (AddressType IN (N'shipping', N'billing'))
  );
  CREATE INDEX IX_CustomerAccountAddresses_UserType ON dbo.CustomerAccountAddresses(UserID, AddressType, IsDefault DESC);
END;
