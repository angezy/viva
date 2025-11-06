-- create_dashboard_tables.sql
-- Run this script in sqlcmd or SSMS to create the dashboard tables (Orders, Notifications, DashboardSettings)
-- It is safe to run multiple times; existing tables will be dropped and re-created.

SET NOCOUNT ON;
PRINT 'Starting dashboard tables creation...';

:r ./create_orders_tbl.sql
:r ./create_notifications_tbl.sql
:r ./create_dashboard_settings_tbl.sql

PRINT 'Dashboard tables creation complete.';
