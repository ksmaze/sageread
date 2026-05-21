use serde::{Deserialize, Serialize};
use sqlx::{migrate::MigrateDatabase, Row, Sqlite, SqlitePool};
use std::collections::HashSet;
use std::fs;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Deserialize, Serialize, Debug)]
struct DefaultSkill {
    name: String,
    content: String,
    is_system: bool,
    is_active: bool,
}

const LEARNING_NOTE_SKILL_NAME: &str = "生成学习笔记";
const LEGACY_LEARNING_NOTE_SKILL_CONTENT: &str = r#"# 生成学习笔记标准流程

根据最近聊天记录和当前章节，生成精简、可复习的书籍笔记，并保存到当前书籍的 notes 数据库。

## 执行步骤

1. **理解输入** - 综合用户请求、最近聊天记录、【当前阅读章节】和已有语义上下文，确定 1 个最重要的知识点。
2. **补充依据** - 如需章节原文依据，优先用 ragSearch/ragContext 获取相关片段；不要用 chunk_id 作为笔记位置。
3. **确认位置** - 选择 1-3 条短原文候选，调用 resolveNoteSource 在当前章节内确认 CFI。
4. **保存笔记** - 调用 createNote 保存标题、正文和位置；matched 使用 matches[0] 的 cfi/sourceText/contextBefore/contextAfter，chapter-start 只使用 fallback.cfi。
5. **简短反馈** - 告诉用户已保存，并概括笔记标题和定位方式。

## 笔记格式

- 标题：不超过 20 个字，突出概念或结论。
- 正文：3-5 个短要点，优先写可复习的信息，不写闲聊过程。
- 可以包含“为什么重要”“如何理解”“相关疑问”等内容，但总量要精简。

## 位置规则

- CFI 必须来自 resolveNoteSource 或 reader selection，不能编造。
- 如果 resolveNoteSource 返回 matched，保存真实 sourceText。
- 如果只返回 chapter-start，不要填写 sourceText。
- 如果没有当前书籍上下文，不要保存书籍笔记，先说明需要在阅读器内使用。

## 使用场景

- 用户点击“生成学习笔记”。
- 用户明确说“把这个总结成笔记”“保存为学习笔记”。
- 对话中已经形成明确重要结论，且用户允许自动保存时。"#;

fn should_refresh_default_skill_content(skill: &DefaultSkill, existing_content: &str) -> bool {
    skill.name == LEARNING_NOTE_SKILL_NAME
        && existing_content == LEGACY_LEARNING_NOTE_SKILL_CONTENT
        && skill.content != existing_content
}

pub async fn initialize(app_handle: &AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let db_dir = app_data_dir.join("database");
    fs::create_dir_all(&db_dir)?;

    let db_path = db_dir.join("app.db");
    let db_url = format!(
        "sqlite:{}",
        db_path.to_str().ok_or("Invalid database path")?
    );

    let is_new_db = !Sqlite::database_exists(&db_url).await.unwrap_or(false);

    if is_new_db {
        Sqlite::create_database(&db_url).await?;
        println!("Database created at: {}", db_url);
    } else {
        println!("Database found at: {}", db_url);
    }

    let pool = SqlitePool::connect(&db_url).await?;

    sqlx::query(include_str!("./schema.sql"))
        .execute(&pool)
        .await?;
    ensure_note_location_columns(&pool).await?;
    println!("Database schema initialized.");

    ensure_default_skills(&pool).await?;

    Ok(pool)
}

async fn ensure_note_location_columns(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let rows = sqlx::query("PRAGMA table_info(notes)")
        .fetch_all(pool)
        .await?;
    let existing: HashSet<String> = rows
        .iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .collect();

    for (column, definition) in [
        ("cfi", "TEXT"),
        ("source_text", "TEXT"),
        ("context_before", "TEXT"),
        ("context_after", "TEXT"),
    ] {
        if !existing.contains(column) {
            sqlx::query(&format!(
                "ALTER TABLE notes ADD COLUMN {} {}",
                column, definition
            ))
            .execute(pool)
            .await?;
        }
    }

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notes_book_id_cfi ON notes(book_id, cfi)")
        .execute(pool)
        .await?;

    Ok(())
}

async fn ensure_default_skills(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    let default_skills_json = include_str!("./default-skills.json");
    let default_skills: Vec<DefaultSkill> = serde_json::from_str(default_skills_json)?;

    println!("Ensuring {} default skills...", default_skills.len());

    for skill in default_skills {
        let skill_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();

        let insert_result = sqlx::query(
            r#"
            INSERT OR IGNORE INTO skills (id, name, content, is_active, is_system, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&skill_id)
        .bind(&skill.name)
        .bind(&skill.content)
        .bind(if skill.is_active { 1 } else { 0 })
        .bind(if skill.is_system { 1 } else { 0 })
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        if insert_result.rows_affected() == 0 {
            let existing = sqlx::query("SELECT content FROM skills WHERE name = ?")
                .bind(&skill.name)
                .fetch_optional(pool)
                .await?;

            if let Some(row) = existing {
                let existing_content: String = row.try_get("content")?;
                if should_refresh_default_skill_content(&skill, &existing_content) {
                    sqlx::query("UPDATE skills SET content = ?, updated_at = ? WHERE name = ?")
                        .bind(&skill.content)
                        .bind(now)
                        .bind(&skill.name)
                        .execute(pool)
                        .await?;

                    println!("Default skill refreshed: {}", skill.name);
                }
            }
        }

        println!("Default skill available: {}", skill.name);
    }

    println!("Default skills check completed.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        should_refresh_default_skill_content, DefaultSkill, LEGACY_LEARNING_NOTE_SKILL_CONTENT,
    };

    #[test]
    fn refreshes_stock_legacy_learning_note_skill_only() {
        let bundled = DefaultSkill {
            name: "生成学习笔记".to_string(),
            content: "new bundled content".to_string(),
            is_system: false,
            is_active: true,
        };

        assert!(should_refresh_default_skill_content(
            &bundled,
            LEGACY_LEARNING_NOTE_SKILL_CONTENT
        ));
        assert!(!should_refresh_default_skill_content(
            &bundled,
            "user edited content"
        ));
    }

    #[test]
    fn does_not_refresh_other_default_skills() {
        let bundled = DefaultSkill {
            name: "生成思维导图".to_string(),
            content: "new bundled content".to_string(),
            is_system: false,
            is_active: true,
        };

        assert!(!should_refresh_default_skill_content(
            &bundled,
            LEGACY_LEARNING_NOTE_SKILL_CONTENT
        ));
    }
}
