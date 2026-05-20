// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod core;
use crate::core::{
    android_system::{process_text, take_opened_book_urls},
    backup::{create_backup_archive, import_backup_archive},
    books::commands::{
        create_book_note,
        create_reading_session,
        delete_book,
        delete_book_note,
        get_active_reading_session,
        get_all_reading_sessions,
        get_book_by_id,
        get_book_notes,
        get_book_status,
        get_book_with_status_by_id,
        get_books,
        get_books_with_status,
        get_reading_session,
        get_reading_sessions_by_book,
        save_book,
        update_book,
        update_book_note,
        update_book_status,
        update_reading_session,
    },
    database,
    notes::commands::{create_note, delete_note, get_note_by_id, get_notes, update_note},
    skills::commands::{
        create_skill, delete_skill, get_skill_by_id, get_skills, toggle_skill_active,
        update_skill,
    },
    state::AppState,
    tags::commands::{
        create_tag, delete_tag, get_tag_by_id, get_tag_by_name, get_tags, update_tag,
    },
    threads::commands::{
        create_thread, delete_thread, edit_thread, get_all_threads, get_latest_thread_by_book_id,
        get_thread_by_id, get_threads_by_book_id,
    },
};
use std::sync::Mutex;
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
use tauri::Emitter;
use tauri::Manager;

#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
const OPEN_FILE_EVENT: &str = "open-file";

#[derive(Default)]
struct OpenedUrls(Mutex<Vec<String>>);

impl OpenedUrls {
    #[cfg(any(test, target_os = "macos", target_os = "ios", target_os = "android"))]
    fn push(&self, urls: Vec<String>) {
        let mut guard = self.0.lock().unwrap_or_else(|error| error.into_inner());
        guard.extend(urls);
    }

    fn take(&self) -> Vec<String> {
        let mut guard = self.0.lock().unwrap_or_else(|error| error.into_inner());
        std::mem::take(&mut *guard)
    }
}

#[tauri::command]
async fn opened_urls<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    opened_urls: tauri::State<'_, OpenedUrls>,
) -> Result<Vec<String>, String> {
    Ok(merge_opened_urls(
        opened_urls.take(),
        take_opened_book_urls(app).await?,
    ))
}

fn merge_opened_urls(mut queued_urls: Vec<String>, native_urls: Vec<String>) -> Vec<String> {
    for url in native_urls {
        if !queued_urls.contains(&url) {
            queued_urls.push(url);
        }
    }
    queued_urls
}

#[cfg(target_os = "android")]
use jni::{
    errors::ThrowRuntimeExAndDefault,
    objects::{JClass, JObject},
    EnvUnowned,
};

#[tauri::command]
async fn app_ready(_app: tauri::AppHandle) {
    // Show the main window now that the frontend DOM is ready
    // show() is only available on desktop platforms
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    if let Some(main_window) = _app.get_webview_window("main") {
        let _ = main_window.show();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init());

    builder
        .manage(AppState::default())
        .manage(OpenedUrls::default())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(crate::core::android_system::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_epub::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.set_decorations(false) {
                        eprintln!("Failed to set window decorations: {}", e);
                    }
                }
            }

            tauri::async_runtime::spawn(async move {
                let pool = database::initialize(&app_handle)
                    .await
                    .expect("Failed to initialize database");

                let state = app_handle.state::<AppState>();
                let mut db_pool_guard = state.db_pool.lock().await;
                *db_pool_guard = Some(pool);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_thread,
            edit_thread,
            delete_thread,
            get_latest_thread_by_book_id,
            get_threads_by_book_id,
            get_thread_by_id,
            get_all_threads,
            save_book,
            get_books,
            get_book_by_id,
            update_book,
            delete_book,
            get_book_status,
            update_book_status,
            get_books_with_status,
            get_book_with_status_by_id,
            // reading sessions
            create_reading_session,
            get_reading_session,
            update_reading_session,
            get_reading_sessions_by_book,
            get_active_reading_session,
            get_all_reading_sessions,
            // book notes
            create_book_note,
            get_book_notes,
            update_book_note,
            delete_book_note,
            create_tag,
            get_tags,
            get_tag_by_id,
            get_tag_by_name,
            update_tag,
            delete_tag,
            // notes
            create_note,
            update_note,
            delete_note,
            get_note_by_id,
            get_notes,
            // skills
            create_skill,
            get_skills,
            get_skill_by_id,
            update_skill,
            delete_skill,
            toggle_skill_active,
            app_ready,
            process_text,
            opened_urls,
            create_backup_archive,
            import_backup_archive,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
            {
                let _ = (app_handle, event);
            }

            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let tauri::RunEvent::Opened { urls } = event {
                let url_strings = urls
                    .into_iter()
                    .map(|url| url.to_string())
                    .collect::<Vec<_>>();

                app_handle.state::<OpenedUrls>().push(url_strings.clone());

                if let Err(error) = app_handle.emit(OPEN_FILE_EVENT, url_strings) {
                    log::warn!("failed to emit opened file URLs: {}", error);
                }
            }
        });
}

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "C" fn Java_com_xincmm_sageread_MainActivity_java_1init(
    mut env: EnvUnowned,
    _class: JClass,
    context: JObject,
) {
    env.with_env(|env| rustls_platform_verifier::android::init_with_env(env, context))
        .resolve::<ThrowRuntimeExAndDefault>();
}

#[cfg(test)]
mod tests {
    use super::{merge_opened_urls, OpenedUrls};

    #[test]
    fn opened_urls_drains_queued_urls_once() {
        let opened_urls = OpenedUrls::default();

        opened_urls.push(vec![
            "file:///books/example.epub".to_string(),
            "content://downloads/document/example.pdf".to_string(),
        ]);

        assert_eq!(
            opened_urls.take(),
            vec![
                "file:///books/example.epub".to_string(),
                "content://downloads/document/example.pdf".to_string(),
            ]
        );
        assert!(opened_urls.take().is_empty());
    }

    #[test]
    fn opened_urls_merges_native_urls_without_duplicates() {
        assert_eq!(
            merge_opened_urls(
                vec![
                    "content://downloads/document/example.epub".to_string(),
                    "file:///books/example.pdf".to_string(),
                ],
                vec![
                    "content://downloads/document/example.epub".to_string(),
                    "content://downloads/document/other.epub".to_string(),
                ],
            ),
            vec![
                "content://downloads/document/example.epub".to_string(),
                "file:///books/example.pdf".to_string(),
                "content://downloads/document/other.epub".to_string(),
            ]
        );
    }
}
