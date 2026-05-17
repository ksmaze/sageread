use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::Path,
};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

const BACKUP_SCHEMA_VERSION: u32 = 1;
const BACKUP_DATABASE_ENTRY: &str = "database.json";
const BACKUP_MANIFEST_ENTRY: &str = "manifest.json";
const CONFIG_FILE_NAMES: &[&str] = &[
    "model-provider.json",
    "app-settings.json",
    "llama-store.json",
    "layout-store.json",
];
const LOCAL_STORAGE_KEYS: &[&str] = &["tts-config-storage"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub schema_version: u32,
    pub created_at: i64,
    pub skipped_books: Vec<SkippedBook>,
    pub contains_sensitive_data: bool,
    pub encrypted: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupTable {
    pub name: String,
    pub rows: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupData {
    pub manifest: BackupManifest,
    pub tables: Vec<BackupTable>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupLocalStorageItem {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupExportResult {
    pub archive_path: String,
    pub file_name: String,
    pub manifest: BackupManifest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupImportResult {
    pub mode: ImportMode,
    pub imported_books: usize,
    pub imported_rows: usize,
    pub restored_config_files: usize,
    pub local_storage_items: Vec<BackupLocalStorageItem>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportMode {
    Merge,
    Overwrite,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BookExportCandidate {
    pub id: String,
    pub title: String,
    pub file_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedBook {
    pub id: String,
    pub title: String,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BookExportScope {
    pub included_book_ids: HashSet<String>,
    pub skipped_books: Vec<SkippedBook>,
}

struct BackupArchive {
    data: BackupData,
    book_files: Vec<ArchiveFile>,
    config_files: Vec<ArchiveFile>,
    local_storage_items: Vec<BackupLocalStorageItem>,
}

struct ArchiveFile {
    relative_path: String,
    bytes: Vec<u8>,
}

pub fn backup_file_name(timestamp_millis: i64) -> String {
    let created_at =
        DateTime::<Utc>::from_timestamp_millis(timestamp_millis).unwrap_or_else(Utc::now);
    format!("sageread-backup-{}.zip", created_at.format("%Y%m%d-%H%M%S"))
}

#[tauri::command]
pub async fn create_backup_archive(
    app_handle: AppHandle,
    local_storage_items: Option<Vec<BackupLocalStorageItem>>,
) -> Result<BackupExportResult, String> {
    let pool = get_db_pool(&app_handle).await?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败: {error}"))?;
    let app_config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| format!("获取应用配置目录失败: {error}"))?;
    let temp_dir = app_handle
        .path()
        .temp_dir()
        .map_err(|error| format!("获取临时目录失败: {error}"))?;

    fs::create_dir_all(&temp_dir).map_err(|error| format!("创建临时目录失败: {error}"))?;

    let data = collect_backup_data(&pool, &app_data_dir).await?;
    let file_name = backup_file_name(data.manifest.created_at);
    let archive_path = temp_dir.join(&file_name);

    write_backup_zip(
        &archive_path,
        &app_data_dir,
        &app_config_dir,
        &data,
        &allowed_local_storage_items(local_storage_items.unwrap_or_default()),
    )?;

    Ok(BackupExportResult {
        archive_path: archive_path.to_string_lossy().to_string(),
        file_name,
        manifest: data.manifest,
    })
}

#[tauri::command]
pub async fn import_backup_archive(
    app_handle: AppHandle,
    archive_path: String,
    mode: ImportMode,
) -> Result<BackupImportResult, String> {
    let archive = read_backup_zip(Path::new(&archive_path))?;
    validate_backup_archive(&archive)?;

    let pool = get_db_pool(&app_handle).await?;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败: {error}"))?;
    let app_config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| format!("获取应用配置目录失败: {error}"))?;
    let restored_book_ids = book_ids_to_restore(&pool, &archive.data, mode).await?;

    if mode == ImportMode::Overwrite {
        let books_dir = app_data_dir.join("books");
        if books_dir.exists() {
            fs::remove_dir_all(&books_dir).map_err(|error| format!("清空书籍文件失败: {error}"))?;
        }
    }

    restore_book_files(&app_data_dir, &archive.book_files, &restored_book_ids)?;
    let restored_config_files = if mode == ImportMode::Overwrite {
        restore_config_files(&app_config_dir, &archive.config_files)?
    } else {
        0
    };

    apply_backup_data_to_database(&pool, &archive.data, mode).await?;

    Ok(BackupImportResult {
        mode,
        imported_books: restored_book_ids.len(),
        imported_rows: archive
            .data
            .tables
            .iter()
            .map(|table| table.rows.len())
            .sum(),
        restored_config_files,
        local_storage_items: if mode == ImportMode::Overwrite {
            archive.local_storage_items
        } else {
            Vec::new()
        },
    })
}

pub fn filter_book_export_scope(
    books: &[BookExportCandidate],
    existing_relative_paths: &HashSet<String>,
) -> BookExportScope {
    let mut included_book_ids = HashSet::new();
    let mut skipped_books = Vec::new();

    for book in books {
        let normalized_path = normalize_relative_path(&book.file_path);
        if existing_relative_paths.contains(&normalized_path) {
            included_book_ids.insert(book.id.clone());
        } else {
            skipped_books.push(SkippedBook {
                id: book.id.clone(),
                title: book.title.clone(),
                reason: "missing_book_file".to_string(),
            });
        }
    }

    BookExportScope {
        included_book_ids,
        skipped_books,
    }
}

pub fn should_apply_imported_record(
    local_updated_at: Option<i64>,
    imported_updated_at: Option<i64>,
) -> bool {
    match (local_updated_at, imported_updated_at) {
        (None, _) => true,
        (Some(_), None) => false,
        (Some(local), Some(imported)) => imported >= local,
    }
}

fn normalize_relative_path(path: &str) -> String {
    path.replace('\\', "/").trim_start_matches('/').to_string()
}

#[derive(Clone, Copy)]
enum ColumnType {
    Text,
    Integer,
}

struct ColumnSpec {
    name: &'static str,
    column_type: ColumnType,
}

struct TableSpec {
    name: &'static str,
    columns: &'static [ColumnSpec],
}

const THREAD_COLUMNS: &[ColumnSpec] = &[
    text_col("id"),
    text_col("book_id"),
    text_col("metadata"),
    text_col("title"),
    text_col("messages"),
    int_col("created_at"),
    int_col("updated_at"),
];

const BOOK_COLUMNS: &[ColumnSpec] = &[
    text_col("id"),
    text_col("title"),
    text_col("author"),
    text_col("format"),
    text_col("file_path"),
    text_col("cover_path"),
    int_col("file_size"),
    text_col("language"),
    text_col("tags"),
    int_col("created_at"),
    int_col("updated_at"),
];

const BOOK_STATUS_COLUMNS: &[ColumnSpec] = &[
    text_col("book_id"),
    text_col("status"),
    int_col("progress_current"),
    int_col("progress_total"),
    text_col("location"),
    int_col("last_read_at"),
    int_col("started_at"),
    int_col("completed_at"),
    text_col("metadata"),
    int_col("created_at"),
    int_col("updated_at"),
];

const READING_SESSION_COLUMNS: &[ColumnSpec] = &[
    text_col("id"),
    text_col("book_id"),
    int_col("started_at"),
    int_col("ended_at"),
    int_col("duration_seconds"),
    int_col("created_at"),
    int_col("updated_at"),
];

const TAG_COLUMNS: &[ColumnSpec] = &[
    text_col("id"),
    text_col("name"),
    text_col("color"),
    int_col("created_at"),
    int_col("updated_at"),
];

const NOTE_COLUMNS: &[ColumnSpec] = &[
    text_col("id"),
    text_col("book_id"),
    text_col("book_meta"),
    text_col("title"),
    text_col("content"),
    text_col("cfi"),
    text_col("source_text"),
    text_col("context_before"),
    text_col("context_after"),
    int_col("created_at"),
    int_col("updated_at"),
];

const BOOK_NOTE_COLUMNS: &[ColumnSpec] = &[
    text_col("id"),
    text_col("book_id"),
    text_col("type"),
    text_col("cfi"),
    text_col("text"),
    text_col("style"),
    text_col("color"),
    text_col("note"),
    text_col("context_before"),
    text_col("context_after"),
    int_col("created_at"),
    int_col("updated_at"),
];

const SKILL_COLUMNS: &[ColumnSpec] = &[
    text_col("id"),
    text_col("name"),
    text_col("content"),
    int_col("is_active"),
    int_col("is_system"),
    int_col("created_at"),
    int_col("updated_at"),
];

const TABLE_SPECS: &[TableSpec] = &[
    TableSpec {
        name: "tags",
        columns: TAG_COLUMNS,
    },
    TableSpec {
        name: "skills",
        columns: SKILL_COLUMNS,
    },
    TableSpec {
        name: "books",
        columns: BOOK_COLUMNS,
    },
    TableSpec {
        name: "book_status",
        columns: BOOK_STATUS_COLUMNS,
    },
    TableSpec {
        name: "reading_sessions",
        columns: READING_SESSION_COLUMNS,
    },
    TableSpec {
        name: "notes",
        columns: NOTE_COLUMNS,
    },
    TableSpec {
        name: "book_notes",
        columns: BOOK_NOTE_COLUMNS,
    },
    TableSpec {
        name: "threads",
        columns: THREAD_COLUMNS,
    },
];

const fn text_col(name: &'static str) -> ColumnSpec {
    ColumnSpec {
        name,
        column_type: ColumnType::Text,
    }
}

const fn int_col(name: &'static str) -> ColumnSpec {
    ColumnSpec {
        name,
        column_type: ColumnType::Integer,
    }
}

pub async fn collect_backup_data(
    pool: &SqlitePool,
    app_data_dir: &Path,
) -> Result<BackupData, String> {
    let books = collect_book_candidates(pool).await?;
    let existing_files = collect_existing_relative_files(app_data_dir)?;
    let scope = filter_book_export_scope(&books, &existing_files);
    let mut tables = Vec::new();

    for spec in TABLE_SPECS {
        let rows = export_table_rows(pool, spec, &scope.included_book_ids).await?;
        tables.push(BackupTable {
            name: spec.name.to_string(),
            rows,
        });
    }

    Ok(BackupData {
        manifest: BackupManifest {
            schema_version: BACKUP_SCHEMA_VERSION,
            created_at: Utc::now().timestamp_millis(),
            skipped_books: scope.skipped_books,
            contains_sensitive_data: true,
            encrypted: false,
        },
        tables,
    })
}

async fn collect_book_candidates(pool: &SqlitePool) -> Result<Vec<BookExportCandidate>, String> {
    let rows = sqlx::query("SELECT id, title, file_path FROM books ORDER BY id ASC")
        .fetch_all(pool)
        .await
        .map_err(|error| format!("查询书籍导出范围失败: {error}"))?;

    rows.iter()
        .map(|row| {
            Ok(BookExportCandidate {
                id: row
                    .try_get("id")
                    .map_err(|error| format!("读取书籍ID失败: {error}"))?,
                title: row
                    .try_get("title")
                    .map_err(|error| format!("读取书籍标题失败: {error}"))?,
                file_path: row
                    .try_get("file_path")
                    .map_err(|error| format!("读取书籍路径失败: {error}"))?,
            })
        })
        .collect()
}

fn collect_existing_relative_files(app_data_dir: &Path) -> Result<HashSet<String>, String> {
    let mut files = HashSet::new();
    if !app_data_dir.exists() {
        return Ok(files);
    }

    for entry in WalkDir::new(app_data_dir) {
        let entry = entry.map_err(|error| format!("读取应用数据目录失败: {error}"))?;
        if !entry.file_type().is_file() {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(app_data_dir)
            .map_err(|error| format!("计算相对路径失败: {error}"))?;
        files.insert(normalize_relative_path(&relative.to_string_lossy()));
    }

    Ok(files)
}

async fn export_table_rows(
    pool: &SqlitePool,
    spec: &TableSpec,
    included_book_ids: &HashSet<String>,
) -> Result<Vec<Value>, String> {
    let query = format!(
        "SELECT * FROM {} ORDER BY {}",
        spec.name,
        primary_key_for_table(spec.name)
    );
    let rows = sqlx::query(&query)
        .fetch_all(pool)
        .await
        .map_err(|error| format!("导出表 {} 失败: {error}", spec.name))?;

    let mut exported_rows = Vec::new();
    for row in rows {
        let value = sqlite_row_to_json(&row, spec.columns)
            .map_err(|error| format!("转换表 {} 数据失败: {error}", spec.name))?;
        if should_export_row(spec.name, &value, included_book_ids) {
            exported_rows.push(value);
        }
    }
    Ok(exported_rows)
}

fn sqlite_row_to_json(
    row: &sqlx::sqlite::SqliteRow,
    columns: &[ColumnSpec],
) -> Result<Value, sqlx::Error> {
    let mut object = Map::new();

    for column in columns {
        let value = match column.column_type {
            ColumnType::Text => row
                .try_get::<Option<String>, _>(column.name)?
                .map(Value::String)
                .unwrap_or(Value::Null),
            ColumnType::Integer => row
                .try_get::<Option<i64>, _>(column.name)?
                .map(|value| Value::Number(value.into()))
                .unwrap_or(Value::Null),
        };
        object.insert(column.name.to_string(), value);
    }

    Ok(Value::Object(object))
}

fn should_export_row(table_name: &str, row: &Value, included_book_ids: &HashSet<String>) -> bool {
    match table_name {
        "books" => row_string(row, "id").is_some_and(|id| included_book_ids.contains(id)),
        "book_status" | "reading_sessions" | "book_notes" => {
            row_string(row, "book_id").is_some_and(|book_id| included_book_ids.contains(book_id))
        }
        "notes" | "threads" => match row_string(row, "book_id") {
            Some(book_id) => included_book_ids.contains(book_id),
            None => true,
        },
        _ => true,
    }
}

fn row_string<'a>(row: &'a Value, key: &str) -> Option<&'a str> {
    row.get(key).and_then(Value::as_str)
}

fn primary_key_for_table(table_name: &str) -> &'static str {
    match table_name {
        "book_status" => "book_id",
        _ => "id",
    }
}

fn unique_key_for_table(table_name: &str) -> Option<&'static str> {
    match table_name {
        "tags" | "skills" => Some("name"),
        _ => None,
    }
}

pub async fn apply_backup_data_to_database(
    pool: &SqlitePool,
    data: &BackupData,
    mode: ImportMode,
) -> Result<(), String> {
    if data.manifest.schema_version != BACKUP_SCHEMA_VERSION {
        return Err(format!(
            "不支持的备份版本: {}",
            data.manifest.schema_version
        ));
    }

    if mode == ImportMode::Overwrite {
        clear_user_tables(pool).await?;
    }

    for spec in TABLE_SPECS {
        let Some(table) = data.tables.iter().find(|table| table.name == spec.name) else {
            continue;
        };

        for row in &table.rows {
            if mode == ImportMode::Merge && !should_apply_row(pool, spec, row).await? {
                continue;
            }
            upsert_row(pool, spec, row).await?;
        }
    }

    Ok(())
}

async fn clear_user_tables(pool: &SqlitePool) -> Result<(), String> {
    for table_name in [
        "threads",
        "book_notes",
        "reading_sessions",
        "book_status",
        "notes",
        "books",
        "tags",
        "skills",
    ] {
        let sql = format!("DELETE FROM {table_name}");
        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|error| format!("清空表 {table_name} 失败: {error}"))?;
    }
    Ok(())
}

async fn should_apply_row(
    pool: &SqlitePool,
    spec: &TableSpec,
    row: &Value,
) -> Result<bool, String> {
    let primary_key = primary_key_for_table(spec.name);
    let primary_key_value = row
        .get(primary_key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("表 {} 缺少主键 {}", spec.name, primary_key))?;
    if let Some(local_updated_at) =
        get_local_updated_at(pool, spec.name, primary_key, primary_key_value).await?
    {
        return Ok(should_apply_imported_record(
            Some(local_updated_at),
            row.get("updated_at").and_then(Value::as_i64),
        ));
    }

    if let Some(unique_key) = unique_key_for_table(spec.name) {
        if let Some(unique_value) = row.get(unique_key).and_then(Value::as_str) {
            if let Some(local_updated_at) =
                get_local_updated_at(pool, spec.name, unique_key, unique_value).await?
            {
                return Ok(should_apply_imported_record(
                    Some(local_updated_at),
                    row.get("updated_at").and_then(Value::as_i64),
                ));
            }
        }
    }

    Ok(true)
}

async fn get_local_updated_at(
    pool: &SqlitePool,
    table_name: &str,
    key_name: &str,
    key_value: &str,
) -> Result<Option<i64>, String> {
    let sql = format!("SELECT updated_at FROM {table_name} WHERE {key_name} = ?");
    sqlx::query_scalar::<_, Option<i64>>(&sql)
        .bind(key_value)
        .fetch_optional(pool)
        .await
        .map(|value| value.flatten())
        .map_err(|error| format!("查询表 {table_name} 现有记录失败: {error}"))
}

async fn upsert_row(pool: &SqlitePool, spec: &TableSpec, row: &Value) -> Result<(), String> {
    let primary_key = primary_key_for_table(spec.name);
    let row = row_with_existing_unique_primary_key(pool, spec, row).await?;
    let columns = spec
        .columns
        .iter()
        .map(|column| column.name)
        .collect::<Vec<_>>();
    let update_columns = columns
        .iter()
        .filter(|column| **column != primary_key)
        .map(|column| format!("{column} = excluded.{column}"))
        .collect::<Vec<_>>()
        .join(", ");

    let mut values_builder = QueryBuilder::<Sqlite>::new(format!(
        "INSERT INTO {} ({}) VALUES (",
        spec.name,
        columns.join(", ")
    ));
    {
        let mut separated = values_builder.separated(", ");
        for column in spec.columns {
            match column.column_type {
                ColumnType::Text => separated.push_bind(json_text_value(&row, column.name)),
                ColumnType::Integer => separated.push_bind(json_integer_value(&row, column.name)),
            };
        }
    }
    values_builder.push(format!(
        ") ON CONFLICT({}) DO UPDATE SET {}",
        primary_key, update_columns
    ));

    values_builder
        .build()
        .execute(pool)
        .await
        .map_err(|error| format!("写入表 {} 失败: {error}", spec.name))?;

    Ok(())
}

async fn row_with_existing_unique_primary_key(
    pool: &SqlitePool,
    spec: &TableSpec,
    row: &Value,
) -> Result<Value, String> {
    let Some(unique_key) = unique_key_for_table(spec.name) else {
        return Ok(row.clone());
    };
    let Some(unique_value) = row.get(unique_key).and_then(Value::as_str) else {
        return Ok(row.clone());
    };
    let primary_key = primary_key_for_table(spec.name);
    let primary_key_value = row
        .get(primary_key)
        .and_then(Value::as_str)
        .unwrap_or_default();
    let sql = format!(
        "SELECT {primary_key} FROM {} WHERE {unique_key} = ? AND {primary_key} != ?",
        spec.name
    );
    let existing_primary_key = sqlx::query_scalar::<_, String>(&sql)
        .bind(unique_value)
        .bind(primary_key_value)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("查询表 {} 唯一名称冲突失败: {error}", spec.name))?;

    let Some(existing_primary_key) = existing_primary_key else {
        return Ok(row.clone());
    };
    let mut row = row.clone();
    let Some(object) = row.as_object_mut() else {
        return Err(format!("表 {} 的导入行不是对象", spec.name));
    };
    object.insert(primary_key.to_string(), Value::String(existing_primary_key));
    Ok(row)
}

async fn get_db_pool(app_handle: &AppHandle) -> Result<SqlitePool, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败: {error}"))?;
    let db_path = app_data_dir.join("database").join("app.db");
    let db_url = format!("sqlite:{}", db_path.display());

    SqlitePool::connect(&db_url)
        .await
        .map_err(|error| format!("数据库连接失败: {error}"))
}

fn write_backup_zip(
    archive_path: &Path,
    app_data_dir: &Path,
    app_config_dir: &Path,
    data: &BackupData,
    local_storage_items: &[BackupLocalStorageItem],
) -> Result<(), String> {
    let file =
        fs::File::create(archive_path).map_err(|error| format!("创建备份文件失败: {error}"))?;
    let mut zip = ZipWriter::new(file);

    write_json_entry(&mut zip, BACKUP_MANIFEST_ENTRY, &data.manifest)?;
    write_json_entry(&mut zip, BACKUP_DATABASE_ENTRY, data)?;
    write_config_entries(&mut zip, app_config_dir)?;
    write_local_storage_entries(&mut zip, local_storage_items)?;
    write_book_entries(&mut zip, app_data_dir, &book_ids_in_backup_data(data))?;

    zip.finish()
        .map_err(|error| format!("完成备份压缩包失败: {error}"))?;
    Ok(())
}

fn write_json_entry<T: Serialize>(
    zip: &mut ZipWriter<fs::File>,
    name: &str,
    value: &T,
) -> Result<(), String> {
    let bytes =
        serde_json::to_vec_pretty(value).map_err(|error| format!("序列化备份数据失败: {error}"))?;
    zip.start_file(name, zip_file_options())
        .map_err(|error| format!("写入备份条目 {name} 失败: {error}"))?;
    zip.write_all(&bytes)
        .map_err(|error| format!("写入备份条目 {name} 失败: {error}"))
}

fn write_config_entries(
    zip: &mut ZipWriter<fs::File>,
    app_config_dir: &Path,
) -> Result<(), String> {
    for file_name in CONFIG_FILE_NAMES {
        let source_path = app_config_dir.join(file_name);
        if !source_path.is_file() {
            continue;
        }
        let bytes = fs::read(&source_path)
            .map_err(|error| format!("读取配置文件 {file_name} 失败: {error}"))?;
        let archive_name = format!("config/{file_name}");
        zip.start_file(&archive_name, zip_file_options())
            .map_err(|error| format!("写入配置文件 {file_name} 失败: {error}"))?;
        zip.write_all(&bytes)
            .map_err(|error| format!("写入配置文件 {file_name} 失败: {error}"))?;
    }
    Ok(())
}

fn write_local_storage_entries(
    zip: &mut ZipWriter<fs::File>,
    local_storage_items: &[BackupLocalStorageItem],
) -> Result<(), String> {
    for item in local_storage_items {
        if !is_allowed_local_storage_key(&item.key) {
            continue;
        }
        let archive_name = format!("local-storage/{}.json", item.key);
        zip.start_file(&archive_name, zip_file_options())
            .map_err(|error| format!("写入本地配置 {} 失败: {error}", item.key))?;
        zip.write_all(item.value.as_bytes())
            .map_err(|error| format!("写入本地配置 {} 失败: {error}", item.key))?;
    }
    Ok(())
}

fn write_book_entries(
    zip: &mut ZipWriter<fs::File>,
    app_data_dir: &Path,
    included_book_ids: &HashSet<String>,
) -> Result<(), String> {
    let books_dir = app_data_dir.join("books");
    if !books_dir.exists() {
        return Ok(());
    }

    for entry in WalkDir::new(&books_dir) {
        let entry = entry.map_err(|error| format!("读取书籍文件失败: {error}"))?;
        if !entry.file_type().is_file() {
            continue;
        }
        let relative_path = entry
            .path()
            .strip_prefix(app_data_dir)
            .map_err(|error| format!("计算书籍文件路径失败: {error}"))?;
        let relative_path = normalize_relative_path(&relative_path.to_string_lossy());
        if !should_include_book_file(&relative_path, included_book_ids) {
            continue;
        }

        zip.start_file(&relative_path, zip_file_options())
            .map_err(|error| format!("写入书籍文件 {relative_path} 失败: {error}"))?;
        let mut source_file = fs::File::open(entry.path())
            .map_err(|error| format!("打开书籍文件 {relative_path} 失败: {error}"))?;
        std::io::copy(&mut source_file, zip)
            .map_err(|error| format!("压缩书籍文件 {relative_path} 失败: {error}"))?;
    }
    Ok(())
}

fn read_backup_zip(archive_path: &Path) -> Result<BackupArchive, String> {
    let file =
        fs::File::open(archive_path).map_err(|error| format!("打开备份文件失败: {error}"))?;
    let mut zip = ZipArchive::new(file).map_err(|error| format!("读取备份压缩包失败: {error}"))?;
    let mut manifest: Option<BackupManifest> = None;
    let mut data: Option<BackupData> = None;
    let mut book_files = Vec::new();
    let mut config_files = Vec::new();
    let mut local_storage_items = Vec::new();

    for index in 0..zip.len() {
        let mut file = zip
            .by_index(index)
            .map_err(|error| format!("读取备份条目失败: {error}"))?;
        if file.is_dir() {
            continue;
        }
        let entry_name = normalize_archive_entry_name(file.name())?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)
            .map_err(|error| format!("读取备份条目 {entry_name} 失败: {error}"))?;

        match entry_name.as_str() {
            BACKUP_MANIFEST_ENTRY => {
                manifest = Some(
                    serde_json::from_slice(&bytes)
                        .map_err(|error| format!("解析备份清单失败: {error}"))?,
                );
            }
            BACKUP_DATABASE_ENTRY => {
                data = Some(
                    serde_json::from_slice(&bytes)
                        .map_err(|error| format!("解析备份数据库数据失败: {error}"))?,
                );
            }
            _ if entry_name.starts_with("books/") => {
                validate_book_archive_path(&entry_name)?;
                book_files.push(ArchiveFile {
                    relative_path: entry_name,
                    bytes,
                });
            }
            _ if is_allowed_config_archive_path(&entry_name) => {
                serde_json::from_slice::<Value>(&bytes)
                    .map_err(|error| format!("配置文件 {entry_name} 不是有效 JSON: {error}"))?;
                config_files.push(ArchiveFile {
                    relative_path: entry_name,
                    bytes,
                });
            }
            _ if is_allowed_local_storage_archive_path(&entry_name) => {
                serde_json::from_slice::<Value>(&bytes)
                    .map_err(|error| format!("本地配置 {entry_name} 不是有效 JSON: {error}"))?;
                let key = entry_name
                    .strip_prefix("local-storage/")
                    .and_then(|name| name.strip_suffix(".json"))
                    .ok_or_else(|| format!("本地配置路径无效: {entry_name}"))?;
                let value = String::from_utf8(bytes)
                    .map_err(|error| format!("本地配置 {entry_name} 不是有效 UTF-8: {error}"))?;
                local_storage_items.push(BackupLocalStorageItem {
                    key: key.to_string(),
                    value,
                });
            }
            _ => {}
        }
    }

    let manifest = manifest.ok_or_else(|| "备份文件缺少 manifest.json".to_string())?;
    let data = data.ok_or_else(|| "备份文件缺少 database.json".to_string())?;
    if data.manifest.schema_version != manifest.schema_version
        || data.manifest.created_at != manifest.created_at
    {
        return Err("备份清单与数据库数据不一致".to_string());
    }

    Ok(BackupArchive {
        data,
        book_files,
        config_files,
        local_storage_items,
    })
}

fn validate_backup_data(data: &BackupData) -> Result<(), String> {
    if data.manifest.schema_version != BACKUP_SCHEMA_VERSION {
        return Err(format!(
            "不支持的备份版本: {}",
            data.manifest.schema_version
        ));
    }

    for table in &data.tables {
        let Some(spec) = TABLE_SPECS.iter().find(|spec| spec.name == table.name) else {
            return Err(format!("备份包含未知数据表: {}", table.name));
        };
        for row in &table.rows {
            if !row.is_object() {
                return Err(format!("表 {} 包含无效记录", table.name));
            }
            let primary_key = primary_key_for_table(spec.name);
            if row.get(primary_key).and_then(Value::as_str).is_none() {
                return Err(format!("表 {} 记录缺少主键 {}", table.name, primary_key));
            }
        }
    }

    Ok(())
}

fn validate_backup_archive(archive: &BackupArchive) -> Result<(), String> {
    validate_backup_data(&archive.data)?;

    let archived_book_files = archive
        .book_files
        .iter()
        .map(|file| file.relative_path.as_str())
        .collect::<HashSet<_>>();

    if let Some(book_table) = archive
        .data
        .tables
        .iter()
        .find(|table| table.name == "books")
    {
        for row in &book_table.rows {
            let file_path = row_string(row, "file_path")
                .ok_or_else(|| "书籍记录缺少 file_path".to_string())
                .map(normalize_relative_path)?;
            if !archived_book_files.contains(file_path.as_str()) {
                let title = row_string(row, "title").unwrap_or("Unknown");
                return Err(format!("备份缺少书籍文件: {title}"));
            }
        }
    }

    Ok(())
}

async fn book_ids_to_restore(
    pool: &SqlitePool,
    data: &BackupData,
    mode: ImportMode,
) -> Result<HashSet<String>, String> {
    let Some(book_table) = data.tables.iter().find(|table| table.name == "books") else {
        return Ok(HashSet::new());
    };

    if mode == ImportMode::Overwrite {
        return Ok(book_table
            .rows
            .iter()
            .filter_map(|row| row_string(row, "id").map(ToString::to_string))
            .collect());
    }

    let book_spec = TABLE_SPECS
        .iter()
        .find(|spec| spec.name == "books")
        .ok_or_else(|| "缺少 books 表定义".to_string())?;
    let mut ids = HashSet::new();
    for row in &book_table.rows {
        if should_apply_row(pool, book_spec, row).await? {
            if let Some(id) = row_string(row, "id") {
                ids.insert(id.to_string());
            }
        }
    }
    Ok(ids)
}

fn restore_book_files(
    app_data_dir: &Path,
    book_files: &[ArchiveFile],
    restored_book_ids: &HashSet<String>,
) -> Result<(), String> {
    for file in book_files {
        let Some(book_id) = book_id_from_relative_path(&file.relative_path) else {
            continue;
        };
        if !restored_book_ids.contains(book_id) {
            continue;
        }
        let target_path = app_data_dir.join(&file.relative_path);
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建书籍目录失败: {error}"))?;
        }
        fs::write(&target_path, &file.bytes)
            .map_err(|error| format!("恢复书籍文件 {} 失败: {error}", file.relative_path))?;
    }
    Ok(())
}

fn restore_config_files(
    app_config_dir: &Path,
    config_files: &[ArchiveFile],
) -> Result<usize, String> {
    fs::create_dir_all(app_config_dir).map_err(|error| format!("创建配置目录失败: {error}"))?;
    let mut restored = 0;

    for file_name in CONFIG_FILE_NAMES {
        let target_path = app_config_dir.join(file_name);
        let archive_path = format!("config/{file_name}");
        if let Some(file) = config_files
            .iter()
            .find(|file| file.relative_path == archive_path)
        {
            fs::write(&target_path, &file.bytes)
                .map_err(|error| format!("恢复配置文件 {file_name} 失败: {error}"))?;
            restored += 1;
        } else if target_path.exists() {
            fs::remove_file(&target_path)
                .map_err(|error| format!("移除旧配置文件 {file_name} 失败: {error}"))?;
        }
    }

    Ok(restored)
}

fn normalize_archive_entry_name(name: &str) -> Result<String, String> {
    if name.contains('\0') {
        return Err("备份条目路径包含无效字符".to_string());
    }
    let normalized = name.replace('\\', "/");
    if normalized.starts_with('/') || normalized.contains(':') {
        return Err(format!("备份条目路径不安全: {name}"));
    }
    let segments = normalized
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();
    if segments.is_empty()
        || segments
            .iter()
            .any(|segment| *segment == "." || *segment == "..")
    {
        return Err(format!("备份条目路径不安全: {name}"));
    }
    Ok(segments.join("/"))
}

fn validate_book_archive_path(path: &str) -> Result<(), String> {
    if book_id_from_relative_path(path).is_none() || !should_include_book_path_shape(path) {
        return Err(format!("备份书籍路径不安全: {path}"));
    }
    Ok(())
}

fn is_allowed_config_archive_path(path: &str) -> bool {
    CONFIG_FILE_NAMES
        .iter()
        .any(|file_name| path == format!("config/{file_name}"))
}

fn is_allowed_local_storage_archive_path(path: &str) -> bool {
    LOCAL_STORAGE_KEYS
        .iter()
        .any(|key| path == format!("local-storage/{key}.json"))
}

fn is_allowed_local_storage_key(key: &str) -> bool {
    LOCAL_STORAGE_KEYS.contains(&key)
}

fn allowed_local_storage_items(items: Vec<BackupLocalStorageItem>) -> Vec<BackupLocalStorageItem> {
    items
        .into_iter()
        .filter(|item| is_allowed_local_storage_key(&item.key))
        .collect()
}

fn should_include_book_file(relative_path: &str, included_book_ids: &HashSet<String>) -> bool {
    let Some(book_id) = book_id_from_relative_path(relative_path) else {
        return false;
    };
    included_book_ids.contains(book_id) && should_include_book_path_shape(relative_path)
}

fn should_include_book_path_shape(relative_path: &str) -> bool {
    let segments = relative_path.split('/').collect::<Vec<_>>();
    if segments.len() < 3 || segments[0] != "books" {
        return false;
    }
    if segments.iter().any(|segment| *segment == "mdbook") {
        return false;
    }
    let Some(file_name) = segments.last() else {
        return false;
    };
    !file_name.starts_with("vectors.sqlite")
}

fn book_id_from_relative_path(relative_path: &str) -> Option<&str> {
    let mut segments = relative_path.split('/');
    match (segments.next(), segments.next()) {
        (Some("books"), Some(book_id)) if !book_id.is_empty() => Some(book_id),
        _ => None,
    }
}

fn book_ids_in_backup_data(data: &BackupData) -> HashSet<String> {
    data.tables
        .iter()
        .find(|table| table.name == "books")
        .map(|table| {
            table
                .rows
                .iter()
                .filter_map(|row| row_string(row, "id").map(ToString::to_string))
                .collect()
        })
        .unwrap_or_default()
}

fn zip_file_options() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated)
}

fn json_text_value(row: &Value, key: &str) -> Option<String> {
    row.get(key).and_then(|value| {
        if value.is_null() {
            None
        } else {
            value.as_str().map(ToString::to_string)
        }
    })
}

fn json_integer_value(row: &Value, key: &str) -> Option<i64> {
    row.get(key).and_then(Value::as_i64)
}

#[cfg(test)]
mod tests {
    use std::{collections::HashSet, fs};

    use sqlx::Row;

    use super::{
        apply_backup_data_to_database, backup_file_name, collect_backup_data,
        filter_book_export_scope, read_backup_zip, should_apply_imported_record,
        validate_backup_archive, write_backup_zip, BackupData, BackupLocalStorageItem,
        BackupManifest, BackupTable, BookExportCandidate, ImportMode, SkippedBook,
    };

    #[test]
    fn backup_file_name_uses_sortable_timestamp() {
        assert_eq!(
            backup_file_name(1_775_008_861_000),
            "sageread-backup-20260401-020101.zip"
        );
    }

    #[test]
    fn filter_book_export_scope_skips_missing_books_and_keeps_existing() {
        let books = vec![
            BookExportCandidate {
                id: "book-ok".into(),
                title: "Exportable".into(),
                file_path: "books/book-ok/book.epub".into(),
            },
            BookExportCandidate {
                id: "book-missing".into(),
                title: "Missing".into(),
                file_path: "books/book-missing/book.epub".into(),
            },
        ];
        let existing = HashSet::from(["books/book-ok/book.epub".to_string()]);

        let scope = filter_book_export_scope(&books, &existing);

        assert_eq!(
            scope.included_book_ids,
            HashSet::from(["book-ok".to_string()])
        );
        assert_eq!(scope.skipped_books.len(), 1);
        assert_eq!(scope.skipped_books[0].id, "book-missing");
        assert_eq!(scope.skipped_books[0].reason, "missing_book_file");
    }

    #[test]
    fn imported_record_wins_when_local_record_is_missing_or_older() {
        assert!(should_apply_imported_record(None, Some(20)));
        assert!(should_apply_imported_record(Some(10), Some(20)));
        assert!(should_apply_imported_record(Some(20), Some(20)));
    }

    #[test]
    fn local_record_wins_when_it_is_newer() {
        assert!(!should_apply_imported_record(Some(30), Some(20)));
    }

    #[tokio::test]
    async fn collect_backup_data_filters_records_for_skipped_missing_books() {
        let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
        sqlx::query(include_str!("../schema.sql"))
            .execute(&pool)
            .await
            .unwrap();
        let now = 100_i64;

        sqlx::query("INSERT INTO books (id, title, author, format, file_path, cover_path, file_size, language, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind("book-ok")
            .bind("Exportable")
            .bind("Author")
            .bind("EPUB")
            .bind("books/book-ok/book.epub")
            .bind(Option::<String>::None)
            .bind(10_i64)
            .bind("en")
            .bind(Option::<String>::None)
            .bind(now)
            .bind(now)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO books (id, title, author, format, file_path, cover_path, file_size, language, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind("book-missing")
            .bind("Missing")
            .bind("Author")
            .bind("EPUB")
            .bind("books/book-missing/book.epub")
            .bind(Option::<String>::None)
            .bind(10_i64)
            .bind("en")
            .bind(Option::<String>::None)
            .bind(now)
            .bind(now)
            .execute(&pool)
            .await
            .unwrap();
        for book_id in ["book-ok", "book-missing"] {
            sqlx::query("INSERT INTO book_status (book_id, status, progress_current, progress_total, location, metadata, created_at, updated_at) VALUES (?, 'reading', 1, 10, '', NULL, ?, ?)")
                .bind(book_id)
                .bind(now)
                .bind(now)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT INTO notes (id, book_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(format!("note-{book_id}"))
                .bind(book_id)
                .bind("Book note")
                .bind("content")
                .bind(now)
                .bind(now)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT INTO threads (id, book_id, metadata, title, messages, created_at, updated_at) VALUES (?, ?, '{}', ?, '[]', ?, ?)")
                .bind(format!("thread-{book_id}"))
                .bind(book_id)
                .bind("Thread")
                .bind(now)
                .bind(now)
                .execute(&pool)
                .await
                .unwrap();
        }
        sqlx::query("INSERT INTO notes (id, book_id, title, content, created_at, updated_at) VALUES ('note-standalone', NULL, 'Standalone', 'content', ?, ?)")
            .bind(now)
            .bind(now)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO threads (id, book_id, metadata, title, messages, created_at, updated_at) VALUES ('thread-global', NULL, '{}', 'Global', '[]', ?, ?)")
            .bind(now)
            .bind(now)
            .execute(&pool)
            .await
            .unwrap();

        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(temp.path().join("books/book-ok")).unwrap();
        std::fs::write(temp.path().join("books/book-ok/book.epub"), b"epub").unwrap();

        let data = collect_backup_data(&pool, temp.path()).await.unwrap();

        assert_eq!(data.manifest.skipped_books.len(), 1);
        assert_eq!(table_ids(&data, "books"), vec!["book-ok"]);
        assert_eq!(table_ids(&data, "book_status"), vec!["book-ok"]);
        assert_eq!(
            table_ids(&data, "notes"),
            vec!["note-book-ok", "note-standalone"]
        );
        assert_eq!(
            table_ids(&data, "threads"),
            vec!["thread-book-ok", "thread-global"]
        );
    }

    #[tokio::test]
    async fn merge_import_applies_newer_rows_and_keeps_newer_local_rows() {
        let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
        sqlx::query(include_str!("../schema.sql"))
            .execute(&pool)
            .await
            .unwrap();

        insert_book(&pool, "local-newer", "Local title", 30).await;
        insert_book(&pool, "import-newer", "Old title", 10).await;

        let data = BackupData {
            manifest: test_manifest(),
            tables: vec![BackupTable {
                name: "books".to_string(),
                rows: vec![
                    book_row("local-newer", "Imported older title", 20),
                    book_row("import-newer", "Imported newer title", 40),
                    book_row("new-book", "New imported title", 5),
                ],
            }],
        };

        apply_backup_data_to_database(&pool, &data, ImportMode::Merge)
            .await
            .unwrap();

        assert_eq!(book_title(&pool, "local-newer").await, "Local title");
        assert_eq!(
            book_title(&pool, "import-newer").await,
            "Imported newer title"
        );
        assert_eq!(book_title(&pool, "new-book").await, "New imported title");
    }

    #[tokio::test]
    async fn overwrite_import_replaces_existing_table_rows() {
        let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
        sqlx::query(include_str!("../schema.sql"))
            .execute(&pool)
            .await
            .unwrap();

        insert_book(&pool, "local-only", "Local only", 30).await;

        let data = BackupData {
            manifest: test_manifest(),
            tables: vec![BackupTable {
                name: "books".to_string(),
                rows: vec![book_row("imported-only", "Imported only", 20)],
            }],
        };

        apply_backup_data_to_database(&pool, &data, ImportMode::Overwrite)
            .await
            .unwrap();

        assert_eq!(book_count(&pool, "local-only").await, 0);
        assert_eq!(book_title(&pool, "imported-only").await, "Imported only");
    }

    #[tokio::test]
    async fn merge_import_resolves_unique_name_conflicts_by_newer_timestamp() {
        let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
        sqlx::query(include_str!("../schema.sql"))
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query("INSERT INTO tags (id, name, color, created_at, updated_at) VALUES ('local-tag', 'Shared', '#111111', 10, 10)")
            .execute(&pool)
            .await
            .unwrap();

        let data = BackupData {
            manifest: test_manifest(),
            tables: vec![BackupTable {
                name: "tags".to_string(),
                rows: vec![serde_json::json!({
                    "id": "imported-tag",
                    "name": "Shared",
                    "color": "#eeeeee",
                    "created_at": 20,
                    "updated_at": 20
                })],
            }],
        };

        apply_backup_data_to_database(&pool, &data, ImportMode::Merge)
            .await
            .unwrap();

        let row = sqlx::query("SELECT id, color FROM tags WHERE name = 'Shared'")
            .fetch_one(&pool)
            .await
            .unwrap();
        let id: String = row.try_get("id").unwrap();
        let color: String = row.try_get("color").unwrap();
        assert_eq!(id, "local-tag");
        assert_eq!(color, "#eeeeee");
        assert_eq!(tag_count(&pool).await, 1);
    }

    #[test]
    fn backup_zip_includes_books_and_config_but_skips_generated_artifacts() {
        let temp = tempfile::tempdir().unwrap();
        let app_data_dir = temp.path().join("data");
        let app_config_dir = temp.path().join("config");
        fs::create_dir_all(app_data_dir.join("books/book-ok/mdbook")).unwrap();
        fs::create_dir_all(&app_config_dir).unwrap();
        fs::write(app_data_dir.join("books/book-ok/book.epub"), b"epub").unwrap();
        fs::write(app_data_dir.join("books/book-ok/cover.jpg"), b"cover").unwrap();
        fs::write(
            app_data_dir.join("books/book-ok/mdbook/index.html"),
            b"generated",
        )
        .unwrap();
        fs::write(
            app_data_dir.join("books/book-ok/vectors.sqlite"),
            b"vectors",
        )
        .unwrap();
        fs::write(
            app_config_dir.join("model-provider.json"),
            br#"{"state":{}}"#,
        )
        .unwrap();

        let data = BackupData {
            manifest: test_manifest(),
            tables: vec![BackupTable {
                name: "books".to_string(),
                rows: vec![book_row("book-ok", "Exportable", 20)],
            }],
        };
        let archive_path = temp.path().join("backup.zip");

        write_backup_zip(
            &archive_path,
            &app_data_dir,
            &app_config_dir,
            &data,
            &[BackupLocalStorageItem {
                key: "tts-config-storage".to_string(),
                value: r#"{"state":{"config":{"apiKey":"secret"}}}"#.to_string(),
            }],
        )
        .unwrap();
        let archive = read_backup_zip(&archive_path).unwrap();
        let mut book_files = archive
            .book_files
            .iter()
            .map(|file| file.relative_path.as_str())
            .collect::<Vec<_>>();
        book_files.sort();
        let config_files = archive
            .config_files
            .iter()
            .map(|file| file.relative_path.as_str())
            .collect::<Vec<_>>();

        assert_eq!(
            book_files,
            vec!["books/book-ok/book.epub", "books/book-ok/cover.jpg"]
        );
        assert_eq!(config_files, vec!["config/model-provider.json"]);
        assert_eq!(archive.local_storage_items.len(), 1);
        assert_eq!(archive.local_storage_items[0].key, "tts-config-storage");
    }

    #[test]
    fn backup_archive_validation_rejects_book_records_without_files() {
        let temp = tempfile::tempdir().unwrap();
        let app_data_dir = temp.path().join("data");
        let app_config_dir = temp.path().join("config");
        fs::create_dir_all(&app_data_dir).unwrap();
        fs::create_dir_all(&app_config_dir).unwrap();

        let data = BackupData {
            manifest: test_manifest(),
            tables: vec![BackupTable {
                name: "books".to_string(),
                rows: vec![book_row("missing-file", "Missing file", 20)],
            }],
        };
        let archive_path = temp.path().join("backup.zip");

        write_backup_zip(&archive_path, &app_data_dir, &app_config_dir, &data, &[]).unwrap();
        let archive = read_backup_zip(&archive_path).unwrap();

        let error = validate_backup_archive(&archive).unwrap_err();
        assert!(error.contains("备份缺少书籍文件"));
    }

    fn table_ids(data: &super::BackupData, table_name: &str) -> Vec<String> {
        let mut ids = data
            .tables
            .iter()
            .find(|table| table.name == table_name)
            .expect("table should exist")
            .rows
            .iter()
            .map(|row| {
                row.get(if table_name == "book_status" {
                    "book_id"
                } else {
                    "id"
                })
                .and_then(|value| value.as_str())
                .expect("id should exist")
                .to_string()
            })
            .collect::<Vec<_>>();
        ids.sort();
        ids
    }

    fn test_manifest() -> BackupManifest {
        BackupManifest {
            schema_version: 1,
            created_at: 1,
            skipped_books: Vec::<SkippedBook>::new(),
            contains_sensitive_data: true,
            encrypted: false,
        }
    }

    async fn insert_book(pool: &sqlx::SqlitePool, id: &str, title: &str, updated_at: i64) {
        sqlx::query("INSERT INTO books (id, title, author, format, file_path, cover_path, file_size, language, tags, created_at, updated_at) VALUES (?, ?, 'Author', 'EPUB', ?, NULL, 10, 'en', NULL, ?, ?)")
            .bind(id)
            .bind(title)
            .bind(format!("books/{id}/book.epub"))
            .bind(updated_at)
            .bind(updated_at)
            .execute(pool)
            .await
            .unwrap();
    }

    fn book_row(id: &str, title: &str, updated_at: i64) -> serde_json::Value {
        serde_json::json!({
            "id": id,
            "title": title,
            "author": "Author",
            "format": "EPUB",
            "file_path": format!("books/{id}/book.epub"),
            "cover_path": null,
            "file_size": 10,
            "language": "en",
            "tags": null,
            "created_at": updated_at,
            "updated_at": updated_at
        })
    }

    async fn book_title(pool: &sqlx::SqlitePool, id: &str) -> String {
        sqlx::query_scalar::<_, String>("SELECT title FROM books WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    async fn book_count(pool: &sqlx::SqlitePool, id: &str) -> i64 {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM books WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    async fn tag_count(pool: &sqlx::SqlitePool) -> i64 {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM tags")
            .fetch_one(pool)
            .await
            .unwrap()
    }
}
