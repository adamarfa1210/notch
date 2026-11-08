use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State};

pub mod buffer;
pub mod clipboard;
pub mod server;

pub use buffer::{FifoBuffer, ItemType, StagedItem};
pub use clipboard::ClipboardMonitor;
pub use server::LocalHttpServer;

pub struct AppState {
    pub buffer: Arc<FifoBuffer>,
}

#[tauri::command]
pub fn get_buffer(state: State<'_, AppState>) -> Vec<StagedItem> {
    state.buffer.get_all()
}

#[tauri::command]
pub fn set_notch_state(app: AppHandle, state: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let monitor = window
            .current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "No monitor found".to_string())?;

        let screen_width = monitor.size().width as f64;
        let scale_factor = monitor.scale_factor();

        let (target_w, target_h) = match state {
            "expanded" => (440.0, 96.0),
            _ => (140.0, 12.0),
        };

        let target_x = (screen_width - (target_w * scale_factor)) / 2.0;

        window
            .set_size(PhysicalSize::new(
                (target_w * scale_factor) as u32,
                (target_h * scale_factor) as u32,
            ))
            .map_err(|e| e.to_string())?;

        window
            .set_position(PhysicalPosition::new(target_x as i32, 0))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_buffer_item(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let removed = state.buffer.remove_by_id(&id);
    if removed {
        emit_buffer_update(&app, &state.buffer);
    }
    Ok(removed)
}

#[tauri::command]
pub fn clear_buffer(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.buffer.clear();
    emit_buffer_update(&app, &state.buffer);
    Ok(())
}

pub fn emit_buffer_update(app: &AppHandle, buffer: &Arc<FifoBuffer>) {
    let items = buffer.get_all();
    let count = items.len();
    let payload = serde_json::json!({
        "items": items,
        "count": count,
        "max": 5
    });
    let _ = app.emit("buffer-updated", payload);
}

pub fn run_tauri() {
    let buffer = Arc::new(FifoBuffer::new(5));

    // Start background HTTP daemon
    let http_server = LocalHttpServer::new();
    let _ = http_server.start(Arc::clone(&buffer), 49152);

    tauri::Builder::default()
        .manage(AppState {
            buffer: Arc::clone(&buffer),
        })
        .setup({
            let buffer = Arc::clone(&buffer);
            move |app| {
                // Initial window position at center top
                let app_handle = app.handle().clone();
                let _ = set_notch_state(app_handle.clone(), "collapsed");

                // Start clipboard monitor with reactive Tauri event emitter
                let monitor = ClipboardMonitor::new();
                let app_h = app_handle.clone();
                let buf_clone = Arc::clone(&buffer);

                monitor.start(
                    Arc::clone(&buffer),
                    300,
                    Some(Arc::new(move || {
                        emit_buffer_update(&app_h, &buf_clone);
                    })),
                );

                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_buffer,
            set_notch_state,
            delete_buffer_item,
            clear_buffer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
