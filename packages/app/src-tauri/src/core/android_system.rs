#[cfg(not(target_os = "android"))]
use std::marker::PhantomData;

use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.xincmm.sageread";

#[cfg(target_os = "android")]
#[derive(serde::Deserialize)]
struct OpenedBookUrlsResponse {
    urls: Vec<String>,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedReaderFontAssetResponse {
    file_path: String,
    byte_length: u64,
}

pub struct AndroidSystem<R: Runtime> {
    #[cfg(target_os = "android")]
    mobile_plugin_handle: PluginHandle<R>,
    #[cfg(not(target_os = "android"))]
    _marker: PhantomData<fn() -> R>,
}

#[tauri::command]
pub async fn prepare_reader_font_asset<R: Runtime>(
    app: AppHandle<R>,
    resource_path: String,
) -> Result<PreparedReaderFontAssetResponse, String> {
    #[cfg(target_os = "android")]
    {
        let state = app.state::<AndroidSystem<R>>();
        state
            .mobile_plugin_handle
            .run_mobile_plugin::<PreparedReaderFontAssetResponse>(
                "prepareReaderFontAsset",
                serde_json::json!({ "resourcePath": resource_path }),
            )
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        let _ = resource_path;
        Err("Android reader font asset preparation is only available on Android".to_string())
    }
}

#[tauri::command]
pub async fn process_text<R: Runtime>(app: AppHandle<R>, text: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let state = app.state::<AndroidSystem<R>>();
        state
            .mobile_plugin_handle
            .run_mobile_plugin::<serde_json::Value>(
                "processText",
                serde_json::json!({ "text": text }),
            )
            .map(|_| ())
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        let _ = text;
        Err("Android process text is only available on Android".to_string())
    }
}

#[tauri::command]
pub async fn log_reader_font_diagnostics<R: Runtime>(
    app: AppHandle<R>,
    payload: serde_json::Value,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let state = app.state::<AndroidSystem<R>>();
        state
            .mobile_plugin_handle
            .run_mobile_plugin::<serde_json::Value>("logReaderFontDiagnostics", payload)
            .map(|_| ())
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        log::info!("[SageRead:ReaderFont] {}", payload);
        Ok(())
    }
}

pub async fn take_opened_book_urls<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    #[cfg(target_os = "android")]
    {
        let state = app.state::<AndroidSystem<R>>();
        state
            .mobile_plugin_handle
            .run_mobile_plugin::<OpenedBookUrlsResponse>("takeOpenedBookUrls", serde_json::json!({}))
            .map(|response| response.urls)
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(Vec::new())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("android-system")
        .setup(|app, _api| {
            #[cfg(target_os = "android")]
            let handle = _api.register_android_plugin(PLUGIN_IDENTIFIER, "AndroidSystemPlugin")?;

            app.manage(AndroidSystem {
                #[cfg(target_os = "android")]
                mobile_plugin_handle: handle,
                #[cfg(not(target_os = "android"))]
                _marker: PhantomData::<fn() -> R>,
            });
            Ok(())
        })
        .build()
}
