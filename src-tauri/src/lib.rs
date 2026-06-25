// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Returns the absolute path to the qvac-host.cjs script.
/// In dev (debug builds) this points to the source file next to Cargo.toml (src-tauri/qvac-host.cjs).
/// In production it points to the bundled resource.
#[tauri::command]
fn resolve_qvac_host_path() -> Result<String, String> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let manifest_path = std::path::Path::new(manifest_dir);

    // In debug builds (tauri dev), use the source file in src-tauri/
    if cfg!(debug_assertions) {
        let script = manifest_path.join("qvac-host.cjs");
        return Ok(script.to_string_lossy().to_string());
    }

    // In release/prod, the file is bundled as a resource next to the executable
    // We return a sentinel; the JS side should use resolveResource("qvac-host.cjs")
    // But for simplicity we return the expected resource name and let JS handle resolveResource.
    Ok("qvac-host.cjs".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![greet, resolve_qvac_host_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
