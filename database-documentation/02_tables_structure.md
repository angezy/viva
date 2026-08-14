# Tables and Column Structure

## Database: 24033_nhb

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: 24033_NWP

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: chesterniku

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: master

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: model

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: Momeni

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: msdb

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: paristanick_cashbuyers

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: tempdb

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: viva

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

## Database: weluxo

### dbo.DashboardSettings

Stores configurable application or dashboard settings.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| SettingId | int |  | No |  | Yes (1, 1) | No |
| SettingKey | nvarchar(100) | 100 | No |  | No | No |
| SettingValue | nvarchar(MAX) | MAX | Yes |  | No | No |

**Keys:** PK_DashboardSettings (SettingId); UQ_DashboardSettings_SettingKey (SettingKey)

### dbo.HomeContent_tbl

Purpose inferred from the table name and column metadata; confirm with the owning application domain.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| HomeContentId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Subtitle | nvarchar(MAX) | MAX | Yes |  | No | No |
| ImageUrl | nvarchar(500) | 500 | Yes |  | No | No |
| ButtonText | nvarchar(100) | 100 | Yes |  | No | No |
| ButtonUrl | nvarchar(255) | 255 | Yes |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |

**Keys:** PK_HomeContent_tbl (HomeContentId)

### dbo.Notifications

Stores user-facing notifications and delivery/read state.

| Column | Data type | Length | Nullable | Default | Identity | Computed |
| --- | --- | --- | --- | --- | --- | --- |
| NotificationId | int |  | No |  | Yes (1, 1) | No |
| Title | nvarchar(200) | 200 | No |  | No | No |
| Message | nvarchar(MAX) | MAX | No |  | No | No |
| CreatedAt | datetime |  | No | (getdate()) | No | No |
| IsRead | bit |  | No | ((0)) | No | No |
| IsVisible | bit |  | No | ((1)) | No | No |

**Keys:** PK_Notifications (NotificationId)

