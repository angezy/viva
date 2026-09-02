# Viva

Viva is a full-stack web application built with a Next.js frontend and an Express/GraphQL backend. It includes e-commerce features, user authentication, an admin dashboard, blog/content management, and order-related workflows.

## Features

- Modern storefront UI with product browsing and cart experience
- User authentication and account management
- Admin dashboard for managing products, blog content, and settings
- Backend API with GraphQL and Express routes
- File uploads and content management support
- SQL database integration for orders, users, products, and settings

## Tech Stack

### Frontend
- Next.js
- React
- Material UI
- CSS Modules

### Backend
- Node.js
- Express
- Apollo Server / GraphQL
- MSSQL
- JWT authentication
- Cookie-based sessions

## Project Structure

- `bend/` - Backend server, routes, GraphQL schema, and database config
- `fend/` - Frontend Next.js app and UI components
- `package.json` - Root scripts for installing and running the full app
- `scripts/` - Install and dev startup helpers

## Prerequisites

Make sure you have the following installed:

- Node.js (v18 or newer recommended)
- npm
- Access to an MSSQL database

## Installation

1. Clone the repository
2. Install all dependencies (root, backend, and frontend) with one command:

```bash
npm run install:all
```

This runs `scripts/install-all.js`, which installs packages in the project root, `bend/`, and `fend/`.

## Environment Variables

Create a `.env` file inside the `bend/` directory and configure the following variables:

```env
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_server
DB_DATABASE=your_db_name
JWT_SECRET=your_secret_key
```

You may also need additional API-related variables depending on integrations used by the backend.

### HyperSKU supplier integration

HyperSKU is registered as the `HYPERSKU` supplier by migration `019_hypersku_supplier.sql`. Apply the current migrations with the deployment-only migration identity, then configure the server-only HyperSKU values in `bend/.env` or from the admin dashboard at `/dashboard/integrations`:

```env
HYPERSKU_ENABLED=false
HYPERSKU_API_BASE_URL=https://api.hypersku.com
HYPERSKU_API_KEY=your-hypersku-api-key
HYPERSKU_ACCESS_TOKEN=your-hypersku-access-token
HYPERSKU_USERNAME=your-hypersku-api-username
HYPERSKU_PASSWORD=your-hypersku-api-password
HYPERSKU_TOKEN_URL=https://api.hypersku.com/api/auth/admin/token
HYPERSKU_AUTH_HEADER_PREFIX=
HYPERSKU_STORE_CODE=
```

HyperSKU must enable API access for the account before the connection test can succeed. Use the Integrations page’s **Test API** action after saving credentials; it makes a read-only country-code request. The backend client also exposes HyperSKU’s documented logistics, order creation, order lookup, status, and tracking methods. Keep `HYPERSKU_ENABLED=false` until the supplier SKU mappings and fulfillment workflow have been validated.

To enable customer Google sign-in, add the Google OAuth credentials to `bend/.env` and register the callback URL in Google Cloud:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

Use `https://your-domain/api/auth/google/callback` and the matching frontend origin in production. The Google client secret must remain in the backend environment only.

## Database Design

### Overview

Viva uses MSSQL as its relational database. The database schema includes tables for users, orders, notifications, dashboard settings, headers, and footers.

### Database Setup

For a new store, follow [`docs/reusable-store-installation.md`](docs/reusable-store-installation.md). Create an empty MSSQL database, configure `.env`, then run `npm run db:bootstrap` followed by `npm run owner:bootstrap`. The configured database is the only target; no production database is restored or copied. `database/bootstrap.sql` is the ordered SQLCMD/SSMS artifact.

#### Option 1: Run Complete Database Script (Recommended)

The legacy foundation file is retained for the bootstrap runner and is not a
complete installation by itself. Do not edit a database name into a script.
The target is selected through `DB_DATABASE`/`MIGRATION_DB_DATABASE`.

For the ordered migration runner:

```powershell
$env:ALLOW_SCHEMA_MIGRATIONS="true"
$env:MIGRATION_IDENTITY_CONFIRMED="true"
npm run db:bootstrap
npm run owner:bootstrap
```

Alternatively, open `database/bootstrap.sql` in SSMS with SQLCMD mode enabled,
select the empty target database before execution, and run it. The SQLCMD artifact applies the same
foundation, migrations, and system seed in dependency order. It never restores
or copies another database.

#### Option 2: Existing-install migration

For an existing installation, take a database backup, verify the configured
target, and run the same `npm run db:bootstrap` command. The runner applies
only missing migrations and preserves existing business rows; it refuses a
non-empty database that does not contain the expected legacy foundation.
The files under `bend/TMp/` are historical compatibility scripts and are not
the fresh-store installation path.

### Database Schema

The complete database schema includes the following tables and relationships:

#### **User_tbl** - User accounts and authentication
- `UserID` (INT, PK, Identity) - Unique user identifier
- `Username` (NVARCHAR(100), Unique) - Login username
- `Email` (NVARCHAR(255), Unique) - User email address
- `PasswordHash` (NVARCHAR(255)) - Hashed password (never store plaintext)
- `Role` (NVARCHAR(50)) - User role (`owner`, `admin`, or `customer`; legacy `user` is normalized to `customer`)
- `CreatedAt` (DATETIME) - Account creation timestamp
- `LastLogin` (DATETIME) - Last login timestamp
- `LastIP` (NVARCHAR(45)) - Last login IP address

#### **Products_tbl** - Product catalog
- `PID` (INT, PK, Identity) - Unique product identifier
- `Brand` (NVARCHAR(100)) - Product brand
- `Name` (NVARCHAR(255)) - Product name
- `IMG` (NVARCHAR(500)) - Product image URL
- `Category` (NVARCHAR(100)) - Product category
- `Color` (NVARCHAR(50)) - Product color
- `Stock` (INT) - Inventory count
- `Price` (DECIMAL(10,2)) - Product price
- `Description` (NVARCHAR(MAX)) - Product description
- `Alt` (NVARCHAR(255)) - Image alt text
- `ChosenCount` (INT) - Number of times product was selected/viewed

#### **Orders_tbl** - Customer orders and transactions
- `OrderId` (NVARCHAR(64), PK) - Unique order identifier
- `UserId` (NVARCHAR(64)) - Reference to user who placed order
- `Status` (NVARCHAR(50)) - Order status (e.g., 'pending', 'completed')
- `Total` (DECIMAL(18,2)) - Order total amount
- `Items` (NVARCHAR(MAX)) - JSON array of order items
- `PlacedAt` (DATETIME) - Order creation timestamp
- `StripeSessionId` (NVARCHAR(255)) - Stripe payment session ID
- `StripePaymentIntentId` (NVARCHAR(255)) - Stripe payment intent ID
- `Currency` (NVARCHAR(10)) - Currency code (e.g., 'USD')
- `AmountPaid` (DECIMAL(18,2)) - Amount actually paid
- `PaidAt` (DATETIME) - Payment timestamp
- `FulfillmentProvider` (NVARCHAR(50)) - Shipping provider name
- `FulfillmentOrderId` (NVARCHAR(255)) - Provider's order ID
- `FulfillmentStatus` (NVARCHAR(80)) - Shipping status
- `TrackingNumber` (NVARCHAR(255)) - Package tracking number
- `TrackingCarrier` (NVARCHAR(255)) - Shipping carrier name
- `TrackingUpdatedAt` (DATETIME) - Last tracking update
- `ShippingJson` (NVARCHAR(MAX)) - Full shipping details as JSON
- `CjLogisticName` (NVARCHAR(255)) - CJ logistics provider name
- `CjFromCountryCode` (NVARCHAR(10)) - Origin country code

#### **ProductImages_tbl** - Product images (one-to-many with Products)
- `ImageId` (INT, PK, Identity) - Unique image identifier
- `ProductId` (INT, FK) - Reference to Products_tbl
- `ImagePath` (NVARCHAR(500)) - Image file path/URL
- `CreatedAt` (DATETIME) - Image upload timestamp

#### **ProductVideos_tbl** - Product videos (one-to-many with Products)
- `VideoId` (INT, PK, Identity) - Unique video identifier
- `ProductId` (INT, FK) - Reference to Products_tbl
- `VideoUrl` (NVARCHAR(500)) - Video URL/path
- `CreatedAt` (DATETIME) - Video upload timestamp

#### **ProductAddress_tbl** - Product shipping addresses
- `AddressId` (INT, PK, Identity) - Unique address identifier
- `ProductId` (INT, FK) - Reference to Products_tbl
- `AddressLine` (NVARCHAR(255)) - Address details
- `CreatedAt` (DATETIME) - Address creation timestamp

#### **CjImportedProducts_tbl** - Imported supplier products
- `Id` (INT, PK, Identity) - Unique identifier
- `Pid` (NVARCHAR(120)) - CJ product ID
- `ProductId` (INT, FK) - Reference to Products_tbl
- `Price` (DECIMAL(18,2)) - CJ product price
- `RawJson` (NVARCHAR(MAX)) - Raw CJ API response data
- `CreatedAt` (DATETIME) - Import timestamp
- `UpdatedAt` (DATETIME) - Last update timestamp

### CJ custom website connection

The CJ import page stores products in the Weluxo catalog. For a custom website, it also uses CJ's API store flow: save the site product and variants in CJ, then create a CJ product connection so CJ can match the site's product to the CJ product for fulfillment. Configure these server-only variables before importing:

- `CJ_STORE_SYNC_ENABLED=true`
- `CJ_PRODUCT_CONNECTION_LOGISTICS=PacketPlus` (or a logistics method supported by the CJ account)
- `CJ_SHOP_ID` only when the CJ account has more than one shop; otherwise the API shop bound to the account is used
- `CJ_SOURCE_COUNTRY_CODE`, `CJ_TARGET_COUNTRY_CODE`, and `CJ_CONNECTION_DEFAULT_AREA` for the connection defaults

Apply database migration `018_cj_store_product_connections.sql` to retain sync status. Existing local imports can be retried from Dashboard → API Products using **Sync to CJ**. If CJ has no API shop bound to the account, create/authorize the API store in CJ first; an API key alone does not make the local website appear in CJ.

#### **Comments** - User comments and testimonials
- `CommentId` (INT, PK, Identity) - Unique comment identifier
- `Name` (NVARCHAR(100)) - Commenter name
- `Email` (NVARCHAR(256)) - Commenter email
- `Text` (NVARCHAR(MAX)) - Comment content
- `Img` (NVARCHAR(MAX)) - Commenter profile image
- `ShowComment` (BIT) - Visibility flag
- `CreatedAt` (DATETIME) - Comment timestamp

#### **head_tbl** - Hero/header section content
- `HeadId` (INT, PK, Identity) - Unique header identifier
- `Title` (NVARCHAR(100)) - Hero title
- `Text` (NVARCHAR(MAX)) - Hero description
- `Img` (NVARCHAR(MAX)) - Hero image URL
- `Button` (NVARCHAR(MAX)) - Button text
- `ButtonUrl` (NVARCHAR(MAX)) - Button link URL

#### **header_tbl** - Navigation header configuration
- `ID` (INT, PK, Identity) - Unique identifier
- `LogoUrl` (NVARCHAR(255)) - Logo image URL
- `Name` (NVARCHAR(100)) - Site name
- `Home` (NVARCHAR(50)) - Home link label
- `Blog` (NVARCHAR(50)) - Blog link label
- `Shop` (NVARCHAR(50)) - Shop link label
- `AboutUs` (NVARCHAR(50)) - About Us link label

#### **footer_tbl** - Footer section configuration
- `ID` (INT, PK, Identity) - Unique identifier
- `logoText` (NVARCHAR(100)) - Footer logo/branding text
- `description` (NVARCHAR(255)) - Footer description
- `homeLabel` (NVARCHAR(50)) - Home link label
- `homeHref` (NVARCHAR(255)) - Home link URL
- `shopLabel` (NVARCHAR(50)) - Shop link label
- `shopHref` (NVARCHAR(255)) - Shop link URL
- `blogLabel` (NVARCHAR(50)) - Blog link label
- `blogHref` (NVARCHAR(255)) - Blog link URL
- `aboutusLabel` (NVARCHAR(50)) - About Us link label
- `aboutusHref` (NVARCHAR(255)) - About Us link URL
- `facebook` (NVARCHAR(255)) - Facebook profile URL
- `twitter` (NVARCHAR(255)) - Twitter profile URL
- `instagram` (NVARCHAR(255)) - Instagram profile URL
- `linkedin` (NVARCHAR(255)) - LinkedIn profile URL

### Database Views

#### **homePage_view**
Combines header, hero, and footer content for rendering the homepage. Joins:
- header_tbl (navigation)
- head_tbl (hero section)
- footer_tbl (footer links and social media)

#### **MostChosenProducts**
Returns the top 10 most frequently chosen/viewed products ordered by ChosenCount descending.

### Database Relationships

- **Products_tbl** → ProductImages_tbl (1:N) - One product can have multiple images
- **Products_tbl** → ProductVideos_tbl (1:N) - One product can have multiple videos
- **Products_tbl** → ProductAddress_tbl (1:N) - One product can have multiple addresses
- **Products_tbl** → CjImportedProducts_tbl (1:N) - One product can have multiple CJ imports

### Database Connection

The database connection is configured in `bend/config/db.js`. It uses the environment variables defined in `.env` to establish connections using MSSQL driver.

## Running the App

### Starting the Backend (bend/)

#### Prerequisites for Backend

1. **Navigate to backend directory:**
   ```bash
   cd bend
   ```

2. **Ensure `.env` file exists** in the `bend/` directory:
   ```env
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_SERVER=your_db_server
   DB_DATABASE=your_db_name
   JWT_SECRET=your_secret_key
   ```

3. **Install backend dependencies** (if not already done):
   ```bash
   npm install
   ```

4. **Verify database is running and accessible**

#### Starting the Backend Server

**From the `bend/` directory:**

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

**Backend endpoints:**
- REST API: `http://localhost:5000/api/*`
- GraphQL: `http://localhost:5000/graphql`

### Starting the Frontend (fend/)

#### Prerequisites for Frontend

1. **Navigate to frontend directory:**
   ```bash
   cd fend
   ```

2. **Install frontend dependencies** (if not already done):
   ```bash
   npm install
   ```

#### Starting the Frontend Server

**From the `fend/` directory:**

```bash
npm run dev
```

**Expected Output:**
```
▲ Next.js 14.x.x
- ready started server on 0.0.0.0:3000
```

**Frontend access:**
- Main app: `http://localhost:3000`
- Pages are available at routes such as `/shop` and `/blog`.

### Starting Both Servers Together

#### From Project Root

For the easiest approach, start both servers at once from the project root:

```bash
npm run dev
```

This runs `scripts/start-dev.js`, which starts both servers simultaneously:
- **Backend** starts on `http://localhost:5000`
- **Frontend** starts on `http://localhost:3000`

**Expected Output:**
```
[Backend] Starting server on port 5000...
[Frontend] ▲ Next.js 14.x.x
[Frontend] - ready started server on 0.0.0.0:3000
[Backend] GraphQL server ready at http://localhost:5000/graphql
```

#### Option: Start Backend and Frontend Separately

If you prefer to run servers in separate terminals:

**Terminal 1 - Start Backend:**
```bash
cd bend
npm start
```
Backend will start on `http://localhost:5000`

**Terminal 2 - Start Frontend:**
```bash
cd fend
npm run dev
```
Frontend will start on `http://localhost:3000`

### Accessing the Application

Once both servers are running, you can access:

- **Main App**: [http://localhost:3000](http://localhost:3000)
- **GraphQL API**: [http://localhost:5000/graphql](http://localhost:5000/graphql) (backend)

### Prerequisites Checklist

Before starting the app, ensure you have completed:

1. ✅ **Installed dependencies**
   ```bash
   npm run install:all
   ```

2. ✅ **Created `.env` file** in the `bend/` directory with database credentials:
   ```env
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_SERVER=your_db_server
   DB_DATABASE=your_db_name
   JWT_SECRET=your_secret_key
   ```

3. ✅ **Database is set up and running**
   - Run `scripts/create_database.sql` in SQL Server Management Studio
   - Or use the sqlcmd command provided in the Database Setup section

4. ✅ **Verify database connectivity** - Test your connection with a simple query in SSMS

### Common Port Usage

| Service | Port | URL |
|---------|------|-----|
| Frontend (Next.js) | 3000 | http://localhost:3000 |
| Backend (Express/GraphQL) | 5000 | http://localhost:5000 |

### Troubleshooting

**Error: "Cannot connect to database"**
- Verify `.env` file exists in `bend/` directory with correct credentials
- Check SQL Server is running and accessible
- Verify database name matches `DB_DATABASE` in `.env`

**Error: "Port 3000 or 5000 already in use"**
- Kill the process using that port or change the port in the respective `.env` or config file

**Error: "Module not found"**
- Run `npm run install:all` to ensure all dependencies are installed

**Error: "Backend server won't start"**
- Verify all database environment variables are correctly set in `.env`
- Check that MSSQL Server is running and accessible from your machine
- Verify the backend `/api/health` endpoint and database connectivity

**Frontend not reflecting backend changes**
- Restart both servers for changes to take effect

### Development Workflow

1. **Frontend changes** - Next.js will hot-reload automatically
2. **Backend changes** - Restart the backend server to see changes
3. **Database schema changes** - Run the updated SQL script and restart backend

### Production Build

To build for production:

```bash
cd fend
npm run build
npm start
```

Then build and start the backend as needed for your deployment environment.

## Development Notes

- The frontend uses the Next.js App Router.
- The backend handles API routes and GraphQL operations.
- Database connection settings are stored in `bend/config/db.js`.

## License

This project is for personal or internal use unless otherwise specified by the repository owner.
