use serde::{Deserialize, Serialize};

// 书籍元信息结构体
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BookMeta {
    pub title: String,
    pub author: String,
}

// 主要的笔记结构体
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Note {
    pub id: String,
    #[serde(rename = "bookId")]
    pub book_id: Option<String>,
    #[serde(rename = "bookMeta")]
    pub book_meta: Option<BookMeta>,
    pub title: Option<String>,
    pub content: Option<String>,
    pub cfi: Option<String>,
    #[serde(rename = "sourceText")]
    pub source_text: Option<String>,
    #[serde(rename = "contextBefore")]
    pub context_before: Option<String>,
    #[serde(rename = "contextAfter")]
    pub context_after: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

// 创建笔记时的输入数据
#[derive(Deserialize, Debug)]
pub struct CreateNoteData {
    #[serde(rename = "bookId")]
    pub book_id: Option<String>,
    #[serde(rename = "bookMeta")]
    pub book_meta: Option<BookMeta>,
    pub title: Option<String>,
    pub content: Option<String>,
    pub cfi: Option<String>,
    #[serde(rename = "sourceText")]
    pub source_text: Option<String>,
    #[serde(rename = "contextBefore")]
    pub context_before: Option<String>,
    #[serde(rename = "contextAfter")]
    pub context_after: Option<String>,
}

// 更新笔记时的输入数据
#[derive(Deserialize, Debug)]
pub struct UpdateNoteData {
    pub id: String,
    #[serde(rename = "bookId")]
    pub book_id: Option<Option<String>>, // Option<Option<String>> 支持清空book_id
    #[serde(rename = "bookMeta")]
    pub book_meta: Option<Option<BookMeta>>, // Option<Option<BookMeta>> 支持清空book_meta
    pub title: Option<Option<String>>, // Option<Option<String>> 支持清空title
    pub content: Option<Option<String>>, // Option<Option<String>> 支持清空content
    pub cfi: Option<Option<String>>,   // Option<Option<String>> 支持清空cfi
    #[serde(rename = "sourceText")]
    pub source_text: Option<Option<String>>, // Option<Option<String>> 支持清空source_text
    #[serde(rename = "contextBefore")]
    pub context_before: Option<Option<String>>, // Option<Option<String>> 支持清空context_before
    #[serde(rename = "contextAfter")]
    pub context_after: Option<Option<String>>, // Option<Option<String>> 支持清空context_after
}

// 查询笔记时的选项
#[derive(Deserialize, Debug)]
pub struct NoteQueryOptions {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    #[serde(rename = "bookId")]
    pub book_id: Option<String>,
    pub cfi: Option<String>,
    #[serde(rename = "sortBy")]
    pub sort_by: Option<String>, // "updated_at", "created_at", "title"
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<String>, // "asc", "desc"
}

impl Note {
    pub fn new(
        id: String,
        book_id: Option<String>,
        book_meta: Option<BookMeta>,
        title: Option<String>,
        content: Option<String>,
        cfi: Option<String>,
        source_text: Option<String>,
        context_before: Option<String>,
        context_after: Option<String>,
        created_at: i64,
        updated_at: i64,
    ) -> Self {
        Self {
            id,
            book_id,
            book_meta,
            title,
            content,
            cfi,
            source_text,
            context_before,
            context_after,
            created_at,
            updated_at,
        }
    }

    pub fn from_db_row(row: &sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;

        // 处理book_meta JSON字段
        let book_meta_str: Option<String> = row.try_get("book_meta")?;
        let book_meta = book_meta_str.and_then(|s| serde_json::from_str(&s).ok());

        Ok(Self {
            id: row.try_get("id")?,
            book_id: row.try_get("book_id")?,
            book_meta,
            title: row.try_get("title")?,
            content: row.try_get("content")?,
            cfi: row.try_get("cfi")?,
            source_text: row.try_get("source_text")?,
            context_before: row.try_get("context_before")?,
            context_after: row.try_get("context_after")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

impl CreateNoteData {
    pub fn validate(&self) -> Result<(), String> {
        // 如果有book_id，必须有book_meta
        if self.book_id.is_some() && self.book_meta.is_none() {
            return Err("关联书籍时必须提供书籍信息".to_string());
        }

        // title、content和source_text不能都为空
        if self.title.as_ref().map_or(true, |t| t.trim().is_empty())
            && self.content.as_ref().map_or(true, |c| c.trim().is_empty())
            && self
                .source_text
                .as_ref()
                .map_or(true, |source| source.trim().is_empty())
        {
            return Err("标题、内容和原文摘录不能都为空".to_string());
        }

        Ok(())
    }
}

impl UpdateNoteData {
    pub fn validate(&self) -> Result<(), String> {
        // 如果提供了book_id，必须同时提供book_meta
        if let Some(Some(_)) = &self.book_id {
            if !matches!(&self.book_meta, Some(Some(_))) {
                return Err("关联书籍时必须提供书籍信息".to_string());
            }
        }

        // 如果清空book_id，也要清空book_meta
        if matches!(&self.book_id, Some(None)) {
            if !matches!(&self.book_meta, Some(None)) {
                return Err("取消书籍关联时必须同时清空书籍信息".to_string());
            }
        }

        Ok(())
    }
}

impl Default for NoteQueryOptions {
    fn default() -> Self {
        Self {
            limit: Some(50),
            offset: Some(0),
            book_id: None,
            cfi: None,
            sort_by: Some("updated_at".to_string()),
            sort_order: Some("desc".to_string()),
        }
    }
}
