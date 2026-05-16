use super::models::*;
use sqlx::{QueryBuilder, Sqlite, SqlitePool};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[tauri::command]
pub async fn create_note(app_handle: AppHandle, data: CreateNoteData) -> Result<Note, String> {
    // 验证输入数据
    data.validate()?;

    let db_pool = get_db_pool(&app_handle).await?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    // 将book_meta序列化为JSON字符串
    let book_meta_json = if let Some(ref meta) = data.book_meta {
        Some(serde_json::to_string(meta).map_err(|e| format!("序列化书籍信息失败: {}", e))?)
    } else {
        None
    };

    sqlx::query(
        r#"
        INSERT INTO notes (
            id, book_id, book_meta, title, content, cfi, source_text, context_before, context_after, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&data.book_id)
    .bind(&book_meta_json)
    .bind(&data.title)
    .bind(&data.content)
    .bind(&data.cfi)
    .bind(&data.source_text)
    .bind(&data.context_before)
    .bind(&data.context_after)
    .bind(now)
    .bind(now)
    .execute(&db_pool)
    .await
    .map_err(|e| format!("创建笔记失败: {}", e))?;

    Ok(Note::new(
        id,
        data.book_id,
        data.book_meta,
        data.title,
        data.content,
        data.cfi,
        data.source_text,
        data.context_before,
        data.context_after,
        now,
        now,
    ))
}

#[tauri::command]
pub async fn update_note(app_handle: AppHandle, data: UpdateNoteData) -> Result<Note, String> {
    // 验证输入数据
    data.validate()?;

    let db_pool = get_db_pool(&app_handle).await?;
    let now = chrono::Utc::now().timestamp_millis();
    let mut query_builder = build_update_note_query(&data, now)?;
    let query = query_builder.build();

    let result = query
        .execute(&db_pool)
        .await
        .map_err(|e| format!("更新笔记失败: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("笔记不存在".to_string());
    }

    // 获取更新后的笔记
    get_note_by_id(app_handle, data.id.clone())
        .await?
        .ok_or("更新后获取笔记失败".to_string())
}

fn build_update_note_query(
    data: &UpdateNoteData,
    now: i64,
) -> Result<QueryBuilder<'static, Sqlite>, String> {
    let mut has_updates = false;
    let mut query_builder = QueryBuilder::<Sqlite>::new("UPDATE notes SET ");

    {
        let mut separated = query_builder.separated(", ");

        if let Some(book_id_opt) = &data.book_id {
            has_updates = true;
            separated
                .push("book_id = ")
                .push_bind_unseparated(book_id_opt.clone());
        }

        if let Some(book_meta_opt) = &data.book_meta {
            has_updates = true;
            let book_meta_json = if let Some(ref meta) = book_meta_opt {
                Some(
                    serde_json::to_string(meta)
                        .map_err(|e| format!("序列化书籍信息失败: {}", e))?,
                )
            } else {
                None
            };
            separated
                .push("book_meta = ")
                .push_bind_unseparated(book_meta_json);
        }

        if let Some(title_opt) = &data.title {
            has_updates = true;
            separated
                .push("title = ")
                .push_bind_unseparated(title_opt.clone());
        }

        if let Some(content_opt) = &data.content {
            has_updates = true;
            separated
                .push("content = ")
                .push_bind_unseparated(content_opt.clone());
        }

        if let Some(cfi_opt) = &data.cfi {
            has_updates = true;
            separated
                .push("cfi = ")
                .push_bind_unseparated(cfi_opt.clone());
        }

        if let Some(source_text_opt) = &data.source_text {
            has_updates = true;
            separated
                .push("source_text = ")
                .push_bind_unseparated(source_text_opt.clone());
        }

        if let Some(context_before_opt) = &data.context_before {
            has_updates = true;
            separated
                .push("context_before = ")
                .push_bind_unseparated(context_before_opt.clone());
        }

        if let Some(context_after_opt) = &data.context_after {
            has_updates = true;
            separated
                .push("context_after = ")
                .push_bind_unseparated(context_after_opt.clone());
        }

        if !has_updates {
            return Err("没有需要更新的字段".to_string());
        }

        separated
            .push("updated_at = ")
            .push_bind_unseparated(now)
            .push_unseparated(" WHERE id = ")
            .push_bind_unseparated(data.id.clone());
    }

    Ok(query_builder)
}

#[tauri::command]
pub async fn delete_note(app_handle: AppHandle, id: String) -> Result<(), String> {
    let db_pool = get_db_pool(&app_handle).await?;

    let result = sqlx::query("DELETE FROM notes WHERE id = ?")
        .bind(&id)
        .execute(&db_pool)
        .await
        .map_err(|e| format!("删除笔记失败: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("笔记不存在".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn get_note_by_id(app_handle: AppHandle, id: String) -> Result<Option<Note>, String> {
    let db_pool = get_db_pool(&app_handle).await?;

    let row = sqlx::query("SELECT * FROM notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db_pool)
        .await
        .map_err(|e| format!("查询笔记失败: {}", e))?;

    match row {
        Some(row) => {
            let note = Note::from_db_row(&row).map_err(|e| format!("转换查询结果失败: {}", e))?;
            Ok(Some(note))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn get_notes(
    app_handle: AppHandle,
    options: Option<NoteQueryOptions>,
) -> Result<Vec<Note>, String> {
    let db_pool = get_db_pool(&app_handle).await?;
    let opts = options.unwrap_or_default();

    // 排序
    let sort_by = opts.sort_by.as_deref().unwrap_or("updated_at");
    let sort_order = opts.sort_order.as_deref().unwrap_or("desc");

    let valid_sort_fields = ["updated_at", "created_at", "title"];
    let sort_field = if valid_sort_fields.contains(&sort_by) {
        sort_by
    } else {
        "updated_at"
    };

    let order = if sort_order.to_lowercase() == "asc" {
        "ASC"
    } else {
        "DESC"
    };

    // 分页
    let limit = opts.limit.unwrap_or(50);
    let offset = opts.offset.unwrap_or(0);

    let rows = execute_normal_query(&db_pool, &opts, sort_field, order, limit, offset).await;

    let rows = rows.map_err(|e| format!("查询笔记失败: {}", e))?;

    let notes: Result<Vec<Note>, sqlx::Error> = rows.iter().map(Note::from_db_row).collect();

    notes.map_err(|e| format!("转换查询结果失败: {}", e))
}

async fn execute_normal_query(
    db_pool: &SqlitePool,
    opts: &NoteQueryOptions,
    sort_field: &str,
    order: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<sqlx::sqlite::SqliteRow>, sqlx::Error> {
    let mut query_builder = sqlx::QueryBuilder::new("SELECT * FROM notes");

    let mut has_where = false;
    if let Some(ref book_id) = opts.book_id {
        query_builder.push(" WHERE book_id = ").push_bind(book_id);
        has_where = true;
    }

    if let Some(ref cfi) = opts.cfi {
        query_builder.push(if has_where {
            " AND cfi = "
        } else {
            " WHERE cfi = "
        });
        query_builder.push_bind(cfi);
    }

    query_builder.push(&format!(" ORDER BY {} {}", sort_field, order));
    query_builder.push(&format!(" LIMIT {} OFFSET {}", limit, offset));

    query_builder.build().fetch_all(db_pool).await
}

async fn get_db_pool(app_handle: &AppHandle) -> Result<SqlitePool, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用目录失败: {}", e))?;

    let db_path = app_data_dir.join("database").join("app.db");
    let db_url = format!("sqlite:{}", db_path.display());

    SqlitePool::connect(&db_url)
        .await
        .map_err(|e| format!("数据库连接失败: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_only_update_query_keeps_assignment_bind_unseparated() {
        let data = UpdateNoteData {
            id: "note-1".to_string(),
            book_id: None,
            book_meta: None,
            title: None,
            content: Some(Some("aaa".to_string())),
            cfi: None,
            source_text: None,
            context_before: None,
            context_after: None,
        };

        let query_builder =
            build_update_note_query(&data, 123).expect("content-only update should build a query");
        let sql = query_builder.sql();

        assert!(
            sql.contains("content = ?"),
            "content assignment should bind without an inserted separator: {sql}"
        );
        assert!(
            !sql.contains("content = ,"),
            "content assignment must not contain a comma before the bind: {sql}"
        );
        assert!(
            sql.contains("updated_at = ? WHERE id = ?"),
            "updated_at and id binds should be present: {sql}"
        );
    }

    #[tokio::test]
    async fn content_only_update_query_executes_and_updates_row() {
        use sqlx::Row;

        let db_pool = SqlitePool::connect(":memory:")
            .await
            .expect("in-memory sqlite should connect");
        sqlx::query(
            "CREATE TABLE notes (
                id TEXT PRIMARY KEY NOT NULL,
                content TEXT,
                updated_at INTEGER NOT NULL
            )",
        )
        .execute(&db_pool)
        .await
        .expect("notes table should be created");
        sqlx::query("INSERT INTO notes (id, content, updated_at) VALUES (?, ?, ?)")
            .bind("note-1")
            .bind(Option::<String>::None)
            .bind(1_i64)
            .execute(&db_pool)
            .await
            .expect("seed note should be inserted");

        let data = UpdateNoteData {
            id: "note-1".to_string(),
            book_id: None,
            book_meta: None,
            title: None,
            content: Some(Some("aaa".to_string())),
            cfi: None,
            source_text: None,
            context_before: None,
            context_after: None,
        };

        let mut query_builder =
            build_update_note_query(&data, 123).expect("content-only update should build a query");
        let result = query_builder
            .build()
            .execute(&db_pool)
            .await
            .expect("content-only update should execute");

        assert_eq!(result.rows_affected(), 1);

        let row = sqlx::query("SELECT content, updated_at FROM notes WHERE id = ?")
            .bind("note-1")
            .fetch_one(&db_pool)
            .await
            .expect("updated note should be returned");
        let content: Option<String> = row.try_get("content").expect("content should decode");
        let updated_at: i64 = row.try_get("updated_at").expect("updated_at should decode");

        assert_eq!(content.as_deref(), Some("aaa"));
        assert_eq!(updated_at, 123);
    }
}
