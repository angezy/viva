USE master;
GO

DECLARE
    @SourceDatabase sysname = N'Weluxo',
    @TargetDatabase sysname = N'hibestie',
    @BackupFile nvarchar(500) =
        N'/var/opt/mssql/data/weluxo_to_hibestie.bak',
    @DataDirectory nvarchar(500) =
        N'/var/opt/mssql/data/',
    @SQL nvarchar(MAX),
    @Moves nvarchar(MAX);

IF DB_ID(@SourceDatabase) IS NULL
    THROW 50001, 'Weluxo database does not exist.', 1;

IF DB_ID(@TargetDatabase) IS NOT NULL
    THROW 50002, 'hibestie already exists. It was not overwritten.', 1;

-- Backup Weluxo
SET @SQL =
    N'BACKUP DATABASE ' + QUOTENAME(@SourceDatabase) +
    N' TO DISK = N''' + @BackupFile + N'''
       WITH COPY_ONLY, INIT, STATS = 10;';

EXEC sys.sp_executesql @SQL;

-- Automatically prepare all data and log file locations
SELECT @Moves = STRING_AGG(
    CONVERT(nvarchar(MAX),
        N'MOVE N''' + REPLACE(name, '''', '''''') +
        N''' TO N''' + @DataDirectory + @TargetDatabase +
        CASE
            WHEN type = 0 AND file_id = 1
                THEN N'.mdf'
            WHEN type = 0
                THEN N'_data_' + CAST(file_id AS nvarchar(20)) + N'.ndf'
            WHEN type = 1 AND file_id = 2
                THEN N'_log.ldf'
            ELSE
                N'_log_' + CAST(file_id AS nvarchar(20)) + N'.ldf'
        END + N''''
    ),
    N',' + CHAR(13) + CHAR(10)
) WITHIN GROUP (ORDER BY file_id)
FROM sys.master_files
WHERE database_id = DB_ID(@SourceDatabase);

-- Restore Weluxo as hibestie
SET @SQL =
    N'RESTORE DATABASE ' + QUOTENAME(@TargetDatabase) +
    N' FROM DISK = N''' + @BackupFile + N'''
       WITH ' + @Moves + N',
       RECOVERY,
       STATS = 10;';

EXEC sys.sp_executesql @SQL;

SELECT name, state_desc
FROM sys.databases
WHERE name IN (N'Weluxo', N'hibestie');
GO