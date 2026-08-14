const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sql = require(path.join(root, 'bend', 'node_modules', 'mssql'));

function loadEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const equal = line.indexOf('=');
    if (equal < 0) continue;
    const key = line.slice(0, equal).trim();
    let value = line.slice(equal + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const env = { ...loadEnv(path.join(root, 'bend', '.env')), ...process.env };
const outputDir = path.join(root, 'database-documentation');
const extractionTime = new Date().toISOString();

function q(pool, text) {
  return pool.request().query(text).then(result => Array.isArray(result) ? result : (result.recordset || []));
}

function identifier(value) {
  return `[${String(value ?? '').replace(/]/g, ']]')}]`;
}

function markdown(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function sqlText(value) {
  return String(value ?? '').trim().replace(/;\s*$/, '');
}

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stableKey(...parts) {
  return parts.map(part => String(part ?? '')).join('|');
}

function formatLength(row) {
  const type = String(row.data_type || '').toLowerCase();
  if (!['char', 'varchar', 'nchar', 'nvarchar', 'binary', 'varbinary'].includes(type)) return null;
  if (row.max_length === -1) return 'MAX';
  if (row.max_length == null) return null;
  return ['nchar', 'nvarchar'].includes(type) ? Math.floor(row.max_length / 2) : row.max_length;
}

function formatType(row) {
  const type = String(row.data_type || row.system_type_name || '').toLowerCase();
  let result = row.data_type || row.system_type_name || 'unknown';
  if (row.is_user_defined && row.type_schema_name && row.data_type) {
    result = `${row.type_schema_name}.${row.data_type}`;
  }
  if (['char', 'varchar', 'nchar', 'nvarchar', 'binary', 'varbinary'].includes(type)) {
    result += `(${formatLength(row)})`;
  } else if (['decimal', 'numeric'].includes(type)) {
    result += `(${row.precision},${row.scale})`;
  } else if (['datetime2', 'datetimeoffset', 'time'].includes(type)) {
    result += `(${row.scale})`;
  } else if (type === 'float' && row.precision) {
    result += `(${row.precision})`;
  }
  return result;
}

function typeDeclaration(row) {
  const type = String(row.data_type || row.system_type_name || '').toLowerCase();
  let result = formatType(row);
  if (row.collation_name && ['char', 'varchar', 'text', 'nchar', 'nvarchar', 'ntext'].includes(type)) {
    result += ` COLLATE ${identifier(row.collation_name)}`;
  }
  if (row.is_filestream) result += ' FILESTREAM';
  return result;
}

function objectRef(row, schemaField = 'schema_name', tableField = 'table_name') {
  return `${identifier(row[schemaField])}.${identifier(row[tableField])}`;
}

function inferTablePurpose(table) {
  const names = table.columns.map(c => String(c.column_name).toLowerCase());
  const tableName = String(table.table_name).toLowerCase();
  const has = (...values) => values.some(value => names.includes(value) || tableName.includes(value));
  if (has('support_ticket', 'ticket_id', 'ticket_status', 'priority')) return 'Stores customer support tickets and their workflow state.';
  if (has('order_tracking', 'tracking_number', 'shipment_status')) return 'Stores shipment or order-delivery tracking events and status.';
  if (has('order_item', 'product_id', 'quantity') && tableName.includes('order')) return 'Stores the products and quantities associated with customer orders.';
  if (has('order_id', 'total_amount', 'payment_status', 'shipping_address') || tableName.includes('order')) return 'Stores customer order headers, totals, payment, and fulfillment details.';
  if (has('product_id', 'price', 'product_name', 'sku') || tableName.includes('product')) return 'Stores product catalog records, pricing, and merchandising attributes.';
  if (has('user_id', 'email', 'password_hash') || tableName.includes('user')) return 'Stores application user or customer account information.';
  if (has('notification_id', 'notification_type', 'message') || tableName.includes('notification')) return 'Stores user-facing notifications and delivery/read state.';
  if (has('cart_id', 'cart_item_id', 'quantity') || tableName.includes('cart')) return 'Stores shopping-cart headers or line items.';
  if (has('comment_id', 'comment', 'review') || tableName.includes('comment')) return 'Stores user comments, reviews, or discussion content.';
  if (has('setting', 'setting_key', 'setting_value') || tableName.includes('setting')) return 'Stores configurable application or dashboard settings.';
  if (tableName.includes('header')) return 'Stores configurable site or page header content.';
  if (tableName.includes('footer')) return 'Stores configurable site or page footer content.';
  if (tableName.includes('blog') || has('slug', 'published_at')) return 'Stores editorial or blog content and publication metadata.';
  return 'Purpose inferred from the table name and column metadata; confirm with the owning application domain.';
}

function inferTriggerPurpose(trigger) {
  const definition = String(trigger.definition || '');
  const lower = `${trigger.trigger_name} ${definition}`.toLowerCase();
  const events = [];
  for (const event of ['insert', 'update', 'delete']) {
    if (new RegExp(`\\b${event}\\b`, 'i').test(definition)) events.push(event.toUpperCase());
  }
  let action = 'enforces or performs database-side logic';
  if (/audit|history|log/.test(lower)) action = 'records audit or history information';
  else if (/notification|email|alert/.test(lower)) action = 'creates or updates notifications/alerts';
  else if (/stock|inventory|quantity/.test(lower)) action = 'maintains inventory or quantity-related values';
  else if (/updated_at|modified_at|last_updated/.test(lower)) action = 'maintains modification timestamps';
  else if (/order|shipment|tracking/.test(lower)) action = 'maintains order or fulfillment workflow state';
  const eventText = events.length ? ` for ${events.join(', ')} events` : '';
  return `${action}${eventText}; inferred from trigger metadata and definition keywords.`;
}

function dedupe(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupKey(row) {
  return stableKey(row.object_id, row.constraint_id, row.index_id);
}

function groupConstraints(rows, kind) {
  const map = new Map();
  for (const row of rows) {
    const key = stableKey(row.constraint_id, row.table_id);
    if (!map.has(key)) {
      map.set(key, {
        constraint_id: row.constraint_id,
        constraint_name: row.constraint_name,
        constraint_type: row.constraint_type,
        database_name: row.database_name,
        schema_name: row.schema_name,
        table_name: row.table_name,
        table_id: row.table_id,
        index_type: row.index_type,
        is_disabled: !!row.is_disabled,
        columns: []
      });
    }
    if (row.column_name) map.get(key).columns.push({ column_name: row.column_name, key_ordinal: row.key_ordinal });
  }
  for (const item of map.values()) item.columns.sort((a, b) => (a.key_ordinal || 0) - (b.key_ordinal || 0));
  return [...map.values()].map(item => ({ ...item, constraint_kind: kind, columns: item.columns.map(c => c.column_name) }));
}

function groupIndexes(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = stableKey(row.table_id, row.index_id);
    if (!map.has(key)) {
      map.set(key, {
        table_id: row.table_id,
        database_name: row.database_name,
        schema_name: row.schema_name,
        table_name: row.table_name,
        index_id: row.index_id,
        index_name: row.index_name,
        index_type: row.index_type,
        is_unique: !!row.is_unique,
        is_primary_key: !!row.is_primary_key,
        is_unique_constraint: !!row.is_unique_constraint,
        is_disabled: !!row.is_disabled,
        has_filter: !!row.has_filter,
        filter_definition: row.filter_definition,
        fill_factor: row.fill_factor,
        columns: [],
        included_columns: []
      });
    }
    if (!row.column_name) return;
    const col = { column_name: row.column_name, key_ordinal: row.key_ordinal, is_descending_key: !!row.is_descending_key };
    if (row.is_included_column) map.get(key).included_columns.push(col);
    else map.get(key).columns.push(col);
  }
  return [...map.values()].map(item => ({
    ...item,
    columns: item.columns.sort((a, b) => (a.key_ordinal || 0) - (b.key_ordinal || 0)),
    included_columns: item.included_columns.sort((a, b) => (a.index_column_id || 0) - (b.index_column_id || 0))
  }));
}

function dependencySummary(objectId, dependencyRows) {
  const rows = dependencyRows.filter(row => row.referencing_id === objectId);
  const refs = dedupe(rows.map(row => ({
    database_name: row.referenced_database_name || null,
    schema_name: row.resolved_schema_name || row.referenced_schema_name || null,
    object_name: row.resolved_object_name || row.referenced_entity_name || null,
    object_type: row.referenced_type_desc || (row.referenced_id ? 'UNKNOWN' : 'UNRESOLVED'),
    referenced_id: row.referenced_id || null,
    resolved: !!row.referenced_id
  })), row => stableKey(row.database_name, row.schema_name, row.object_name, row.object_type));
  return {
    referenced_tables: refs.filter(ref => ref.object_type === 'USER_TABLE' || ref.object_type === 'SYSTEM_TABLE' || /TABLE/i.test(ref.object_type)),
    other_references: refs.filter(ref => !(ref.object_type === 'USER_TABLE' || ref.object_type === 'SYSTEM_TABLE' || /TABLE/i.test(ref.object_type)))
  };
}

async function extractDatabase(config, databaseInfo) {
  const meta = {
    database_name: databaseInfo.name,
    database_id: databaseInfo.database_id ?? null,
    create_date: databaseInfo.create_date ?? null,
    compatibility_level: databaseInfo.compatibility_level ?? null,
    state: databaseInfo.state_desc ?? null,
    recovery_model: databaseInfo.recovery_model_desc ?? null,
    user_access: databaseInfo.user_access_desc ?? null,
    is_read_only: !!databaseInfo.is_read_only,
    schemas: [],
    tables: [],
    constraints: { primary_keys: [], unique_constraints: [], foreign_keys: [], check_constraints: [], default_constraints: [] },
    indexes: [],
    views: [],
    stored_procedures: [],
    triggers: [],
    relationships: [],
    extraction_warnings: []
  };

  let pool;
  try {
    pool = await sql.connect(config);
  } catch (error) {
    meta.extraction_warnings.push(`Could not connect to this database: ${error.message}`);
    return meta;
  }

  async function read(name, query) {
    try {
      return await q(pool, query);
    } catch (error) {
      meta.extraction_warnings.push(`${name} metadata query failed: ${error.message}`);
      return [];
    }
  }

  const schemaRows = await read('schemas', `
    SELECT s.schema_id, s.name AS schema_name, s.principal_id,
           CAST(CASE WHEN s.name IN ('dbo','guest','INFORMATION_SCHEMA','sys') THEN 0 ELSE 1 END AS bit) AS is_user_defined
    FROM sys.schemas AS s
    ORDER BY s.name;
  `);
  meta.schemas = schemaRows.map(row => ({ schema_id: row.schema_id, schema_name: row.schema_name, principal_id: row.principal_id, is_user_defined: !!row.is_user_defined }));

  const tableRows = await read('tables', `
    SELECT t.object_id AS table_id, s.schema_id, s.name AS schema_name, t.name AS table_name,
           t.create_date, t.modify_date, t.temporal_type_desc, t.is_memory_optimized, t.is_filetable
    FROM sys.tables AS t
    JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name;
  `);
  const columnRows = await read('columns', `
    SELECT t.object_id AS table_id, c.column_id, c.name AS column_name,
           ty.name AS data_type, sty.name AS system_type_name, tys.name AS type_schema_name,
           ty.is_user_defined, c.max_length, c.precision, c.scale,
           c.is_nullable, c.is_identity, c.is_computed, c.is_sparse, c.is_column_set,
           c.is_filestream, c.is_rowguidcol, c.generated_always_type_desc,
           ic.seed_value, ic.increment_value, ic.is_not_for_replication AS identity_not_for_replication,
           cc.definition AS computed_definition, cc.is_persisted,
           dc.object_id AS default_constraint_id, dc.name AS default_constraint_name, dc.definition AS default_definition,
           c.collation_name
    FROM sys.tables AS t
    JOIN sys.columns AS c ON c.object_id = t.object_id
    JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.types AS sty ON sty.system_type_id = c.system_type_id AND sty.user_type_id = sty.system_type_id
    LEFT JOIN sys.schemas AS tys ON tys.schema_id = ty.schema_id
    LEFT JOIN sys.identity_columns AS ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    LEFT JOIN sys.computed_columns AS cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
    LEFT JOIN sys.default_constraints AS dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE t.is_ms_shipped = 0
    ORDER BY t.object_id, c.column_id;
  `);

  const tableById = new Map();
  for (const row of tableRows) {
    const table = {
      table_id: row.table_id,
      schema_id: row.schema_id,
      schema_name: row.schema_name,
      table_name: row.table_name,
      create_date: row.create_date,
      modify_date: row.modify_date,
      temporal_type: row.temporal_type_desc,
      is_memory_optimized: !!row.is_memory_optimized,
      is_filetable: !!row.is_filetable,
      purpose: '',
      columns: []
    };
    tableById.set(row.table_id, table);
    meta.tables.push(table);
  }
  for (const row of columnRows) {
    const table = tableById.get(row.table_id);
    if (!table) continue;
    table.columns.push({
      column_id: row.column_id,
      column_name: row.column_name,
      data_type: row.data_type,
      system_type_name: row.system_type_name,
      type_schema_name: row.type_schema_name,
      is_user_defined: !!row.is_user_defined,
      formatted_type: formatType(row),
      length: formatLength(row),
      max_length_bytes: row.max_length,
      precision: row.precision,
      scale: row.scale,
      nullable: !!row.is_nullable,
      identity: !!row.is_identity,
      identity_seed: row.seed_value ?? null,
      identity_increment: row.increment_value ?? null,
      identity_not_for_replication: !!row.identity_not_for_replication,
      computed: !!row.is_computed,
      computed_definition: row.computed_definition || null,
      computed_persisted: !!row.is_persisted,
      default_constraint_id: row.default_constraint_id ?? null,
      default_constraint_name: row.default_constraint_name || null,
      default_value: row.default_definition || null,
      sparse: !!row.is_sparse,
      column_set: !!row.is_column_set,
      filestream: !!row.is_filestream,
      rowguidcol: !!row.is_rowguidcol,
      generated_always: row.generated_always_type_desc || null,
      collation: row.collation_name || null
    });
  }
  for (const table of meta.tables) table.purpose = inferTablePurpose(table);

  const keyRows = await read('primary and unique constraints', `
    SELECT kc.object_id AS constraint_id, kc.name AS constraint_name, kc.type_desc AS constraint_type,
           t.object_id AS table_id, s.name AS schema_name, t.name AS table_name,
           i.type_desc AS index_type, i.is_disabled, ic.key_ordinal, c.name AS column_name
    FROM sys.key_constraints AS kc
    JOIN sys.tables AS t ON t.object_id = kc.parent_object_id
    JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    JOIN sys.indexes AS i ON i.object_id = kc.parent_object_id AND i.index_id = kc.unique_index_id
    JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name, kc.name, ic.key_ordinal;
  `);
  meta.constraints.primary_keys = groupConstraints(keyRows.filter(row => row.constraint_type === 'PRIMARY_KEY_CONSTRAINT'), 'PRIMARY KEY');
  meta.constraints.unique_constraints = groupConstraints(keyRows.filter(row => row.constraint_type === 'UNIQUE_CONSTRAINT'), 'UNIQUE');

  const fkRows = await read('foreign keys', `
    SELECT fk.object_id AS constraint_id, fk.name AS constraint_name,
           fk.parent_object_id AS table_id, ps.name AS schema_name, pt.name AS table_name,
           fk.referenced_object_id AS referenced_table_id, rs.name AS referenced_schema_name, rt.name AS referenced_table_name,
           fk.delete_referential_action_desc AS on_delete, fk.update_referential_action_desc AS on_update,
           fk.is_not_for_replication, fk.is_disabled, fkc.constraint_column_id,
           pc.name AS column_name, rc.name AS referenced_column_name
    FROM sys.foreign_keys AS fk
    JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.tables AS pt ON pt.object_id = fk.parent_object_id
    JOIN sys.schemas AS ps ON ps.schema_id = pt.schema_id
    LEFT JOIN sys.tables AS rt ON rt.object_id = fk.referenced_object_id
    LEFT JOIN sys.schemas AS rs ON rs.schema_id = rt.schema_id
    JOIN sys.columns AS pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
    JOIN sys.columns AS rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
    WHERE pt.is_ms_shipped = 0
    ORDER BY ps.name, pt.name, fk.name, fkc.constraint_column_id;
  `);
  const fkMap = new Map();
  for (const row of fkRows) {
    if (!fkMap.has(row.constraint_id)) {
      fkMap.set(row.constraint_id, {
        constraint_id: row.constraint_id,
        constraint_name: row.constraint_name,
        table_id: row.table_id,
        schema_name: row.schema_name,
        table_name: row.table_name,
        referenced_table_id: row.referenced_table_id,
        referenced_schema_name: row.referenced_schema_name,
        referenced_table_name: row.referenced_table_name,
        on_delete: row.on_delete,
        on_update: row.on_update,
        is_not_for_replication: !!row.is_not_for_replication,
        is_disabled: !!row.is_disabled,
        columns: []
      });
    }
    fkMap.get(row.constraint_id).columns.push({ column_name: row.column_name, referenced_column_name: row.referenced_column_name, ordinal: row.constraint_column_id });
  }
  meta.constraints.foreign_keys = [...fkMap.values()].map(fk => ({ ...fk, columns: fk.columns.sort((a, b) => a.ordinal - b.ordinal) }));

  const checkRows = await read('check constraints', `
    SELECT cc.object_id AS constraint_id, cc.name AS constraint_name, cc.parent_object_id AS table_id,
           s.name AS schema_name, t.name AS table_name, cc.definition, cc.is_disabled,
           cc.is_not_for_replication, cc.parent_column_id, c.name AS column_name
    FROM sys.check_constraints AS cc
    JOIN sys.tables AS t ON t.object_id = cc.parent_object_id
    JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    LEFT JOIN sys.columns AS c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name, cc.name;
  `);
  meta.constraints.check_constraints = checkRows.map(row => ({
    constraint_id: row.constraint_id, constraint_name: row.constraint_name, table_id: row.table_id,
    schema_name: row.schema_name, table_name: row.table_name, definition: row.definition,
    column_name: row.column_name || null, is_disabled: !!row.is_disabled, is_not_for_replication: !!row.is_not_for_replication
  }));

  const defaultRows = await read('default constraints', `
    SELECT dc.object_id AS constraint_id, dc.name AS constraint_name, dc.parent_object_id AS table_id,
           s.name AS schema_name, t.name AS table_name, dc.parent_column_id, c.name AS column_name,
           dc.definition, dc.is_system_named
    FROM sys.default_constraints AS dc
    JOIN sys.tables AS t ON t.object_id = dc.parent_object_id
    JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    JOIN sys.columns AS c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE t.is_ms_shipped = 0
    ORDER BY s.name, t.name, dc.name;
  `);
  meta.constraints.default_constraints = defaultRows.map(row => ({
    constraint_id: row.constraint_id, constraint_name: row.constraint_name, table_id: row.table_id,
    schema_name: row.schema_name, table_name: row.table_name, column_name: row.column_name,
    definition: row.definition, is_system_named: !!row.is_system_named
  }));

  const indexRows = await read('indexes', `
    SELECT i.object_id AS table_id, i.index_id, i.name AS index_name, i.type_desc AS index_type,
           i.is_unique, i.is_primary_key, i.is_unique_constraint, i.is_disabled, i.has_filter,
           i.filter_definition, i.fill_factor, s.name AS schema_name, t.name AS table_name,
           ic.index_column_id, ic.key_ordinal, ic.is_included_column, ic.is_descending_key,
           c.name AS column_name
    FROM sys.indexes AS i
    JOIN sys.tables AS t ON t.object_id = i.object_id
    JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    LEFT JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    LEFT JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE t.is_ms_shipped = 0 AND i.index_id > 0 AND i.is_hypothetical = 0
    ORDER BY s.name, t.name, i.index_id, ic.key_ordinal, ic.index_column_id;
  `);
  meta.indexes = groupIndexes(indexRows);

  const viewRows = await read('views', `
    SELECT v.object_id, s.name AS schema_name, v.name AS view_name, v.create_date, v.modify_date,
           OBJECT_DEFINITION(v.object_id) AS definition
    FROM sys.views AS v
    JOIN sys.schemas AS s ON s.schema_id = v.schema_id
    WHERE v.is_ms_shipped = 0
    ORDER BY s.name, v.name;
  `);
  const procRows = await read('stored procedures', `
    SELECT p.object_id, s.name AS schema_name, p.name AS procedure_name, p.create_date, p.modify_date,
           p.is_auto_executed
    FROM sys.procedures AS p
    JOIN sys.schemas AS s ON s.schema_id = p.schema_id
    WHERE p.is_ms_shipped = 0
    ORDER BY s.name, p.name;
  `);
  const parameterRows = await read('procedure parameters', `
    SELECT p.object_id, sp.parameter_id, sp.name AS parameter_name, sp.is_output, sp.has_default_value,
           sp.default_value, sp.is_cursor_ref, sp.is_readonly, ty.name AS data_type,
           sp.max_length, sp.precision, sp.scale
    FROM sys.procedures AS p
    JOIN sys.parameters AS sp ON sp.object_id = p.object_id
    LEFT JOIN sys.types AS ty ON ty.user_type_id = sp.user_type_id
    WHERE p.is_ms_shipped = 0
    ORDER BY p.object_id, sp.parameter_id;
  `);
  const triggerRows = await read('triggers', `
    SELECT tr.object_id AS trigger_id, tr.name AS trigger_name, tr.parent_id, tr.parent_class_desc,
           tr.is_disabled, tr.is_instead_of_trigger, tr.create_date, tr.modify_date,
           OBJECT_DEFINITION(tr.object_id) AS definition,
           s.name AS schema_name, t.name AS table_name
    FROM sys.triggers AS tr
    LEFT JOIN sys.tables AS t ON t.object_id = tr.parent_id
    LEFT JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    WHERE tr.is_ms_shipped = 0
    ORDER BY COALESCE(s.name, ''), COALESCE(t.name, ''), tr.name;
  `);
  const dependencyRows = await read('object dependencies', `
    SELECT sed.referencing_id, sed.referenced_id, sed.referenced_server_name, sed.referenced_database_name,
           sed.referenced_schema_name, sed.referenced_entity_name,
           ro.type_desc AS referenced_type_desc, ro.name AS resolved_object_name,
           rs.name AS resolved_schema_name
    FROM sys.sql_expression_dependencies AS sed
    LEFT JOIN sys.objects AS ro ON ro.object_id = sed.referenced_id
    LEFT JOIN sys.schemas AS rs ON rs.schema_id = ro.schema_id
    WHERE sed.referencing_id IS NOT NULL;
  `);

  const paramsByObject = new Map();
  for (const row of parameterRows) {
    if (!paramsByObject.has(row.object_id)) paramsByObject.set(row.object_id, []);
    paramsByObject.get(row.object_id).push({
      parameter_id: row.parameter_id,
      parameter_name: row.parameter_id === 0 ? 'RETURN_VALUE' : row.parameter_name,
      direction: row.parameter_id === 0 ? 'RETURN' : (row.is_output ? 'OUTPUT' : 'INPUT'),
      data_type: row.data_type,
      length: ['char', 'varchar', 'nchar', 'nvarchar', 'binary', 'varbinary'].includes(String(row.data_type || '').toLowerCase())
        ? (row.max_length === -1 ? 'MAX' : (['nchar', 'nvarchar'].includes(String(row.data_type || '').toLowerCase()) ? Math.floor(row.max_length / 2) : row.max_length)) : null,
      precision: row.precision,
      scale: row.scale,
      has_default: !!row.has_default_value,
      default_value: row.default_value ?? null,
      cursor_ref: !!row.is_cursor_ref,
      readonly: !!row.is_readonly
    });
  }
  meta.views = viewRows.map(row => ({
    object_id: row.object_id, schema_name: row.schema_name, view_name: row.view_name,
    create_date: row.create_date, modify_date: row.modify_date, definition: row.definition || null,
    ...dependencySummary(row.object_id, dependencyRows)
  }));
  meta.stored_procedures = procRows.map(row => ({
    object_id: row.object_id, schema_name: row.schema_name, procedure_name: row.procedure_name,
    create_date: row.create_date, modify_date: row.modify_date,
    is_auto_executed: !!row.is_auto_executed, is_recompiled: null, is_encrypted: null,
    parameters: paramsByObject.get(row.object_id) || [], ...dependencySummary(row.object_id, dependencyRows)
  }));
  meta.triggers = triggerRows.map(row => ({
    trigger_id: row.trigger_id, trigger_name: row.trigger_name, parent_class: row.parent_class_desc,
    schema_name: row.schema_name || null, table_name: row.table_name || null,
    table_id: row.parent_id || null, is_disabled: !!row.is_disabled, is_instead_of: !!row.is_instead_of_trigger,
    create_date: row.create_date, modify_date: row.modify_date, definition: row.definition || null,
    purpose: inferTriggerPurpose(row)
  }));

  const uniqueSets = new Set();
  for (const item of [...meta.constraints.primary_keys, ...meta.constraints.unique_constraints]) uniqueSets.add(stableKey(item.table_id, item.columns.join(',')));
  for (const item of meta.indexes.filter(index => index.is_unique)) uniqueSets.add(stableKey(item.table_id, item.columns.map(c => c.column_name).join(',')));
  meta.relationships = meta.constraints.foreign_keys.map(fk => {
    const childUnique = uniqueSets.has(stableKey(fk.table_id, fk.columns.map(c => c.column_name).join(',')));
    return {
      database_name: meta.database_name,
      table_a: `${fk.schema_name}.${fk.table_name}`,
      table_b: fk.referenced_schema_name && fk.referenced_table_name ? `${fk.referenced_schema_name}.${fk.referenced_table_name}` : null,
      table_a_id: fk.table_id,
      table_b_id: fk.referenced_table_id,
      relationship_type: childUnique ? 'one-to-one' : 'many-to-one',
      foreign_key: fk.constraint_name,
      foreign_key_columns: fk.columns,
      on_delete: fk.on_delete,
      on_update: fk.on_update,
      is_disabled: fk.is_disabled
    };
  });

  sql.close();
  return meta;
}

function mdTable(headers, rows) {
  let out = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`;
  for (const row of rows) out += `| ${row.map(value => markdown(value)).join(' | ')} |\n`;
  return out;
}

function tableLabel(table, databaseName, primaryKeyColumns) {
  const lines = [`<b>${databaseName}.${table.schema_name}.${table.table_name}</b>`];
  const pkColumns = new Set(primaryKeyColumns || []);
  for (const col of table.columns) {
    const marker = pkColumns.has(col.column_name) ? ' 🔑' : '';
    lines.push(`${marker}${col.column_name}: ${col.formatted_type}${col.nullable ? ' nullable' : ''}`);
  }
  return lines.join('<br/>');
}

function buildDrawio(databases) {
  const cells = [];
  const nodes = new Map();
  const headerId = 'database-erd-root';
  cells.push(`<mxCell id="${headerId}" value="Database ERD (metadata only)" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=18;fontStyle=1" vertex="1" parent="1"><mxGeometry x="20" y="20" width="600" height="30" as="geometry"/></mxCell>`);
  let tableIndex = 0;
  for (const db of databases) {
    for (const table of db.tables) {
      const id = `table-${tableIndex++}`;
      nodes.set(stableKey(db.database_name, table.schema_name, table.table_name), id);
      const primaryKeyColumns = (db.constraints.primary_keys.find(pk => pk.table_id === table.table_id) || { columns: [] }).columns;
      const x = 20 + ((tableIndex - 1) % 4) * 360;
      const y = 80 + Math.floor((tableIndex - 1) / 4) * Math.max(150, 70 + table.columns.length * 16);
      const height = Math.max(80, 45 + table.columns.length * 16);
      cells.push(`<mxCell id="${id}" value="${xml(tableLabel(table, db.database_name, primaryKeyColumns))}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;align=left;verticalAlign=top;spacingTop=6;spacingLeft=6;fontSize=11" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="320" height="${height}" as="geometry"/></mxCell>`);
    }
  }
  let edgeIndex = 0;
  for (const db of databases) {
    for (const rel of db.relationships) {
      const source = nodes.get(stableKey(db.database_name, rel.table_a.split('.')[0], rel.table_a.split('.')[1]));
      const target = nodes.get(stableKey(db.database_name, rel.table_b ? rel.table_b.split('.')[0] : '', rel.table_b ? rel.table_b.split('.')[1] : ''));
      if (!source || !target) continue;
      const label = `${rel.foreign_key}: ${rel.foreign_key_columns.map(c => c.column_name).join(', ')} → ${rel.foreign_key_columns.map(c => c.referenced_column_name).join(', ')}`;
      cells.push(`<mxCell id="edge-${edgeIndex++}" value="${xml(label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;fontSize=9" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
    }
  }
  const body = cells.join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="${extractionTime}" agent="Codex database metadata exporter" version="24.7.17"><diagram id="database-erd" name="Database ERD"><mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${body}</root></mxGraphModel></diagram></mxfile>`;
}

function buildOverview(databases) {
  let out = `# Database Overview\n\nGenerated: ${extractionTime}\n\n`;
  out += 'This package documents database structure and metadata only. No application table rows, query results, or user data were read. The exporter used SQL Server catalog views and object-definition metadata.\n\n';
  out += mdTable(['Database', 'State', 'Compatibility', 'Recovery model', 'Read-only', 'Schemas', 'Tables', 'Views', 'Stored procedures', 'Triggers'], databases.map(db => [db.database_name, db.state, db.compatibility_level, db.recovery_model, db.is_read_only ? 'Yes' : 'No', db.schemas.length, db.tables.length, db.views.length, db.stored_procedures.length, db.triggers.length]));
  for (const db of databases.filter(db => db.extraction_warnings.length)) {
    out += `\n## Extraction warnings: ${db.database_name}\n\n`;
    out += db.extraction_warnings.map(warning => `- ${warning}`).join('\n') + '\n';
  }
  out += '\n## Schemas\n\n';
  for (const db of databases) {
    out += `### ${db.database_name}\n\n`;
    out += mdTable(['Schema', 'User-defined', 'Principal ID'], db.schemas.map(schema => [schema.schema_name, schema.is_user_defined ? 'Yes' : 'No', schema.principal_id]));
  }
  return out;
}

function buildTables(databases) {
  let out = '# Tables and Column Structure\n\n';
  for (const db of databases) {
    out += `## Database: ${db.database_name}\n\n`;
    if (!db.tables.length) { out += '_No user tables were returned by the catalog query._\n\n'; continue; }
    for (const table of db.tables) {
      out += `### ${table.schema_name}.${table.table_name}\n\n${table.purpose}\n\n`;
      out += mdTable(['Column', 'Data type', 'Length', 'Nullable', 'Default', 'Identity', 'Computed'], table.columns.map(col => [col.column_name, col.formatted_type, col.length ?? '', col.nullable ? 'Yes' : 'No', col.default_value || '', col.identity ? `Yes (${col.identity_seed}, ${col.identity_increment})` : 'No', col.computed ? `Yes: ${col.computed_definition || ''}${col.computed_persisted ? ' [PERSISTED]' : ''}` : 'No']));
      const keys = [...db.constraints.primary_keys, ...db.constraints.unique_constraints].filter(key => key.table_id === table.table_id);
      if (keys.length) out += `\n**Keys:** ${keys.map(key => `${key.constraint_name} (${key.columns.join(', ')})`).join('; ')}\n`;
      out += '\n';
    }
  }
  return out;
}

function buildRelationships(databases) {
  let out = '# Relationships\n\n';
  out += 'Relationship direction is child table A → referenced parent table B. `many-to-one` is inferred unless the foreign-key columns are themselves unique, in which case `one-to-one` is reported.\n\n';
  for (const db of databases) {
    out += `## Database: ${db.database_name}\n\n`;
    out += mdTable(['Table A', 'Table B', 'Type', 'Foreign key', 'Columns A → B', 'Delete', 'Update', 'Disabled'], db.relationships.map(rel => [rel.table_a, rel.table_b || 'Unresolved', rel.relationship_type, rel.foreign_key, rel.foreign_key_columns.map(c => `${c.column_name} → ${c.referenced_column_name}`).join(', '), rel.on_delete, rel.on_update, rel.is_disabled ? 'Yes' : 'No']));
    if (!db.relationships.length) out += '_No foreign-key relationships were returned._\n';
    out += '\n';
  }
  return out;
}

function buildIndexes(databases) {
  let out = '# Indexes\n\n';
  for (const db of databases) {
    out += `## Database: ${db.database_name}\n\n`;
    out += mdTable(['Table', 'Index', 'Type', 'Key columns', 'Included columns', 'Unique', 'PK/UQ', 'Filter', 'Disabled'], db.indexes.map(index => [
      `${index.schema_name}.${index.table_name}`, index.index_name || '(unnamed)', index.index_type,
      index.columns.map(c => `${c.column_name}${c.is_descending_key ? ' DESC' : ' ASC'}`).join(', '),
      index.included_columns.map(c => c.column_name).join(', '), index.is_unique ? 'Yes' : 'No', index.is_primary_key ? 'PK' : (index.is_unique_constraint ? 'UQ' : ''), index.filter_definition || '', index.is_disabled ? 'Yes' : 'No'
    ]));
    if (!db.indexes.length) out += '_No user-table indexes were returned._\n';
    out += '\n';
  }
  return out;
}

function buildViews(databases) {
  let out = '# Views\n\n';
  for (const db of databases) {
    out += `## Database: ${db.database_name}\n\n`;
    for (const view of db.views) {
      out += `### ${view.schema_name}.${view.view_name}\n\n`;
      out += `Referenced tables: ${view.referenced_tables.length ? view.referenced_tables.map(ref => `${ref.schema_name || ''}.${ref.object_name}`).join(', ') : 'None resolved'}\n\n`;
      if (view.other_references.length) out += `Other/unresolved references: ${view.other_references.map(ref => `${ref.schema_name || ''}.${ref.object_name} (${ref.object_type})`).join(', ')}\n\n`;
      out += '```sql\n' + (view.definition || '-- Definition unavailable (insufficient VIEW DEFINITION permission or encrypted object).') + '\n```\n\n';
    }
    if (!db.views.length) out += '_No user views were returned._\n\n';
  }
  return out;
}

function buildProcedures(databases) {
  let out = '# Stored Procedures\n\n';
  for (const db of databases) {
    out += `## Database: ${db.database_name}\n\n`;
    for (const proc of db.stored_procedures) {
      out += `### ${proc.schema_name}.${proc.procedure_name}\n\n`;
      out += mdTable(['Parameter', 'Direction', 'Data type', 'Length', 'Precision', 'Scale', 'Default', 'Read-only'], proc.parameters.map(param => [param.parameter_name, param.direction, param.data_type, param.length ?? '', param.precision ?? '', param.scale ?? '', param.has_default ? param.default_value : '', param.readonly ? 'Yes' : 'No']));
      out += `\nReferenced tables: ${proc.referenced_tables.length ? proc.referenced_tables.map(ref => `${ref.schema_name || ''}.${ref.object_name}`).join(', ') : 'None resolved'}\n`;
      if (proc.other_references.length) out += `Other/unresolved references: ${proc.other_references.map(ref => `${ref.schema_name || ''}.${ref.object_name} (${ref.object_type})`).join(', ')}\n`;
      if (proc.is_encrypted) out += '\n_The procedure is encrypted; definition text was not extracted._\n';
      out += '\n';
    }
    if (!db.stored_procedures.length) out += '_No user stored procedures were returned._\n\n';
  }
  return out;
}

function buildTriggers(databases) {
  let out = '# Triggers\n\n';
  for (const db of databases) {
    out += `## Database: ${db.database_name}\n\n`;
    out += mdTable(['Trigger', 'Table', 'Trigger class', 'Timing', 'Status', 'Purpose'], db.triggers.map(trigger => [trigger.trigger_name, trigger.table_name ? `${trigger.schema_name}.${trigger.table_name}` : '(database-level)', trigger.parent_class, trigger.is_instead_of ? 'INSTEAD OF' : 'AFTER/FOR', trigger.is_disabled ? 'Disabled' : 'Enabled', trigger.purpose]));
    if (!db.triggers.length) out += '_No user triggers were returned._\n';
    out += '\n';
  }
  return out;
}

function buildBusinessNotes(databases) {
  let out = '# Business Logic Notes\n\n';
  out += 'These notes are structural inferences from names, columns, constraints, dependencies, and trigger text. They are not validated against row contents or application behavior.\n\n';
  for (const db of databases) {
    out += `## ${db.database_name}\n\n`;
    const domains = [];
    for (const table of db.tables) {
      const name = table.table_name.toLowerCase();
      if (/user|account|customer/.test(name)) domains.push('user/account management');
      if (/product|catalog|item/.test(name)) domains.push('product catalog');
      if (/order|cart|checkout|payment/.test(name)) domains.push('commerce and checkout');
      if (/support|ticket|comment|review/.test(name)) domains.push('support and customer communication');
      if (/notification|setting|header|footer|blog|page/.test(name)) domains.push('content, configuration, and notifications');
    }
    out += `- Inferred domains: ${[...new Set(domains)].join(', ') || 'No domain could be inferred from object names'}.\n`;
    out += `- Referential integrity: ${db.constraints.foreign_keys.length} foreign key(s) define relationships; ${db.constraints.check_constraints.length} check constraint(s) add value validation.\n`;
    out += `- Automation: ${db.triggers.length} trigger(s) and ${db.stored_procedures.length} stored procedure(s) may implement database-side behavior.\n`;
    out += '- Dependency caveat: SQL Server dependency metadata does not fully resolve dynamic SQL, temporary objects, or some cross-database references.\n';
    out += '- Security caveat: no row data, credentials, or connection settings are included in this package.\n\n';
  }
  return out;
}

function buildSchemaSql(databases) {
  const lines = [
    '-- Database schema reconstruction generated from SQL Server metadata.',
    '-- Contains only CREATE TABLE, ALTER TABLE ... ADD CONSTRAINT, and CREATE INDEX statements plus comments.',
    '-- Execute each database section in its corresponding database. Schemas are assumed to already exist.',
    ''
  ];
  for (const db of databases) {
    lines.push(`-- DATABASE: ${db.database_name}`);
    lines.push('');
    for (const table of db.tables) {
      const cols = table.columns.map(col => {
        if (col.computed) return `${identifier(col.column_name)} AS ${sqlText(col.computed_definition || 'NULL')}${col.computed_persisted ? ' PERSISTED' : ''}`;
        let line = `${identifier(col.column_name)} ${typeDeclaration({ ...col, data_type: col.data_type, max_length: col.max_length_bytes })}`;
        if (col.identity) line += ` IDENTITY(${col.identity_seed},${col.identity_increment})`;
        if (col.rowguidcol) line += ' ROWGUIDCOL';
        if (col.sparse) line += ' SPARSE';
        line += col.nullable ? ' NULL' : ' NOT NULL';
        return line;
      });
      lines.push(`CREATE TABLE ${identifier(table.schema_name)}.${identifier(table.table_name)} (\n  ${cols.join(',\n  ')}\n);`);
      lines.push('');
    }
    for (const dc of db.constraints.default_constraints) {
      lines.push(`ALTER TABLE ${identifier(dc.schema_name)}.${identifier(dc.table_name)} ADD CONSTRAINT ${identifier(dc.constraint_name)} DEFAULT ${sqlText(dc.definition)} FOR ${identifier(dc.column_name)};`);
    }
    for (const key of [...db.constraints.primary_keys, ...db.constraints.unique_constraints]) {
      const kind = key.constraint_kind === 'PRIMARY KEY' ? 'PRIMARY KEY' : 'UNIQUE';
      const clustered = String(key.index_type || '').toUpperCase() === 'CLUSTERED' ? ' CLUSTERED' : ' NONCLUSTERED';
      lines.push(`ALTER TABLE ${identifier(key.schema_name)}.${identifier(key.table_name)} ADD CONSTRAINT ${identifier(key.constraint_name)} ${kind}${clustered} (${key.columns.map(identifier).join(', ')});`);
    }
    for (const check of db.constraints.check_constraints) {
      const nocheck = check.is_disabled ? ' WITH NOCHECK' : '';
      lines.push(`ALTER TABLE ${identifier(check.schema_name)}.${identifier(check.table_name)}${nocheck} ADD CONSTRAINT ${identifier(check.constraint_name)} CHECK ${sqlText(check.definition)};`);
    }
    for (const fk of db.constraints.foreign_keys) {
      if (!fk.referenced_schema_name || !fk.referenced_table_name) continue;
      const nocheck = fk.is_disabled ? ' WITH NOCHECK' : '';
      const actions = `${fk.on_delete && fk.on_delete !== 'NO_ACTION' ? ` ON DELETE ${fk.on_delete.replace('_', ' ')}` : ''}${fk.on_update && fk.on_update !== 'NO_ACTION' ? ` ON UPDATE ${fk.on_update.replace('_', ' ')}` : ''}`;
      lines.push(`ALTER TABLE ${identifier(fk.schema_name)}.${identifier(fk.table_name)}${nocheck} ADD CONSTRAINT ${identifier(fk.constraint_name)} FOREIGN KEY (${fk.columns.map(c => identifier(c.column_name)).join(', ')}) REFERENCES ${identifier(fk.referenced_schema_name)}.${identifier(fk.referenced_table_name)} (${fk.columns.map(c => identifier(c.referenced_column_name)).join(', ')})${actions};`);
    }
    for (const index of db.indexes.filter(index => !index.is_primary_key && !index.is_unique_constraint && index.index_name)) {
      const type = String(index.index_type || 'NONCLUSTERED').toUpperCase();
      if (type.includes('COLUMNSTORE')) {
        const clustered = type.includes('CLUSTERED') ? 'CLUSTERED' : 'NONCLUSTERED';
        const cols = index.columns.length ? ` (${index.columns.map(c => identifier(c.column_name)).join(', ')})` : '';
        lines.push(`CREATE ${clustered} COLUMNSTORE INDEX ${identifier(index.index_name)} ON ${identifier(index.schema_name)}.${identifier(index.table_name)}${cols};`);
        continue;
      }
      const kind = type.includes('CLUSTERED') ? 'CLUSTERED' : 'NONCLUSTERED';
      const keys = index.columns.length ? index.columns.map(c => `${identifier(c.column_name)}${c.is_descending_key ? ' DESC' : ' ASC'}`).join(', ') : '';
      if (!keys) {
        lines.push(`-- Index ${identifier(index.index_name)} (${type}) has no ordinary key columns; recreate according to its specialized index type.`);
        continue;
      }
      const includes = index.included_columns.length ? ` INCLUDE (${index.included_columns.map(c => identifier(c.column_name)).join(', ')})` : '';
      const filter = index.filter_definition ? ` WHERE ${sqlText(index.filter_definition)}` : '';
      lines.push(`CREATE ${index.is_unique ? 'UNIQUE ' : ''}${kind} INDEX ${identifier(index.index_name)} ON ${identifier(index.schema_name)}.${identifier(index.table_name)} (${keys})${includes}${filter};`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function getDatabaseList(baseConfig) {
  let pool;
  try {
    pool = await sql.connect({ ...baseConfig, database: 'master' });
    const rows = await q(pool, `
      SELECT name, database_id, create_date, compatibility_level, state_desc, recovery_model_desc,
             user_access_desc, is_read_only
      FROM sys.databases
      ORDER BY name;
    `);
    sql.close();
    if (!rows.length) {
      return [{
        name: baseConfig.database,
        database_id: null,
        state_desc: 'UNKNOWN',
        recovery_model_desc: null,
        compatibility_level: null,
        user_access_desc: null,
        is_read_only: false,
        _list_warning: 'master.sys.databases returned no visible databases for this login; only the configured database was inspected.'
      }];
    }
    if (!rows.some(row => String(row.name).toLowerCase() === String(baseConfig.database).toLowerCase())) {
      rows.push({
        name: baseConfig.database,
        database_id: null,
        state_desc: 'UNKNOWN',
        recovery_model_desc: null,
        compatibility_level: null,
        user_access_desc: null,
        is_read_only: false,
        _list_warning: 'The configured database was not visible in master.sys.databases; it was inspected directly.'
      });
    }
    return rows;
  } catch (error) {
    if (pool) sql.close();
    return [{ name: baseConfig.database, database_id: null, state_desc: 'UNKNOWN', recovery_model_desc: null, compatibility_level: null, user_access_desc: null, is_read_only: false, _list_warning: `Could not enumerate sys.databases from master: ${error.message}` }];
  }
}

async function main() {
  if (!env.DB_SERVER || !env.DB_USER || !env.DB_DATABASE) throw new Error('DB_SERVER, DB_USER, and DB_DATABASE must be configured in bend/.env');
  const baseConfig = {
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    server: env.DB_SERVER,
    database: env.DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    connectionTimeout: 15000,
    requestTimeout: 30000
  };
  if (env.DB_PORT) baseConfig.port = Number(env.DB_PORT);

  const databaseList = await getDatabaseList(baseConfig);
  const databases = [];
  for (const info of databaseList) {
    const dbConfig = { ...baseConfig, database: info.name };
    const meta = await extractDatabase(dbConfig, info);
    if (info._list_warning) meta.extraction_warnings.unshift(info._list_warning);
    databases.push(meta);
  }

  // Remove trigger definitions before writing machine-readable output; trigger purposes were inferred in memory.
  for (const db of databases) for (const trigger of db.triggers) delete trigger.definition;

  fs.mkdirSync(outputDir, { recursive: true });
  const json = {
    generated_at: extractionTime,
    metadata_only: true,
    row_data_extracted: false,
    databases
  };
  const files = {
    '01_database_overview.md': buildOverview(databases),
    '02_tables_structure.md': buildTables(databases),
    '03_relationships.md': buildRelationships(databases),
    '04_indexes.md': buildIndexes(databases),
    '05_views.md': buildViews(databases),
    '06_stored_procedures.md': buildProcedures(databases),
    '07_triggers.md': buildTriggers(databases),
    '08_business_logic_notes.md': buildBusinessNotes(databases),
    'database_schema.sql': buildSchemaSql(databases),
    'database_erd.drawio': buildDrawio(databases),
    'database_structure.json': JSON.stringify(json, null, 2)
  };
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(outputDir, name), content, 'utf8');
  console.log(JSON.stringify({ outputDir, database_count: databases.length, tables: databases.reduce((n, db) => n + db.tables.length, 0), views: databases.reduce((n, db) => n + db.views.length, 0), stored_procedures: databases.reduce((n, db) => n + db.stored_procedures.length, 0), triggers: databases.reduce((n, db) => n + db.triggers.length, 0), warnings: databases.reduce((n, db) => n + db.extraction_warnings.length, 0) }));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
