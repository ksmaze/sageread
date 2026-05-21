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

        sqlx::query(
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

        println!("Default skill available: {}", skill.name);
    }

    println!("Default skills check completed.");
    Ok(())
}
