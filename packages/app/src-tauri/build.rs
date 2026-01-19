fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("android") {
        if std::env::var_os("TAURI_CONFIG").is_none() {
            std::env::set_var("TAURI_CONFIG", r#"{"bundle":{"externalBin":[]}}"#);
        }
    }

    tauri_build::build()
}
