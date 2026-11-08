# Tauri v2 Backend & Frontend Integration Contract

Dokumen ini adalah panduan teknis langkah-demi-langkah bagi **Agen Backend** untuk mengimplementasikan fungsionalitas sistem agar klop dengan desain antarmuka Notch di [`frontend/design/notch_ui_spec.figcraft`](./design/notch_ui_spec.figcraft).

---

## 1. Konfigurasi Window Tauri (`src-tauri/tauri.conf.json`)

Jendela aplikasi harus dikonfigurasi sebagai *frameless transparent overlay*:

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Dynamic Notch",
        "width": 140,
        "height": 12,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "shadow": false,
        "resizable": false
      }
    ]
  }
}
```

---

## 2. Koordinat & Dynamic Window Resizing (Rust Backend)

Ketika mouse mengarah ke area notch (*hover*), Frontend akan memanggil command resize ke Backend. Backend mengubah ukuran window secara dinamis:

| State | Lebar | Tinggi | Posisi X (Pusat Monitor) | Posisi Y |
| :--- | :--- | :--- | :--- | :--- |
| **Collapsed (Idle)** | `140 px` | `12 px` | `(ScreenWidth - 140) / 2` | `0` (Menempel bezel atas) |
| **Expanded (Hover)** | `440 px` | `96 px` | `(ScreenWidth - 440) / 2` | `0` (Menempel bezel atas) |

### Implementasi Tauri Command (Rust):
```rust
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[tauri::command]
fn set_notch_state(app: AppHandle, state: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let monitor = window.current_monitor().map_err(|e| e.to_string())?.ok_or("No monitor")?;
        let screen_width = monitor.size().width as f64;
        let scale_factor = monitor.scale_factor();

        let (target_w, target_h) = match state {
            "expanded" => (440.0, 96.0),
            _ => (140.0, 12.0),
        };

        let target_x = (screen_width - (target_w * scale_factor)) / 2.0;

        window.set_size(PhysicalSize::new(
            (target_w * scale_factor) as u32,
            (target_h * scale_factor) as u32,
        )).map_err(|e| e.to_string())?;

        window.set_position(PhysicalPosition::new(target_x as i32, 0))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

---

## 3. Struktur Data FIFO RAM Buffer (Rust Backend)

Kapasitas antrean dibatasi maksimal **5 item**:

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", content = "data")]
pub enum ClipboardPayload {
    Image { base64_preview: String, full_uri: String },
    Text { snippet: String, full_text: String },
    File { file_name: String, file_uri: String, file_size: u64 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipboardItem {
    pub id: String,           // UUID v4
    pub timestamp: u64,
    pub payload: ClipboardPayload,
}
```

---

## 4. Tauri IPC Endpoints

### A. Commands (Frontend ➔ Backend)
* `get_buffer() -> Vec<ClipboardItem>`: Mengambil 5 item yang saat ini ada di RAM.
* `set_notch_state(state: "collapsed" | "expanded")`: Mengubah ukuran window native.
* `delete_buffer_item(id: String)`: Menghapus item tertentu dari antrean (saat tombol `×` diklik).
* `start_drag(id: String)`: Memulai operasi OLE native drag-and-drop keluar jendela.

### B. Events (Backend ➔ Frontend)
* `buffer-updated`: Dipancarkan oleh Backend setiap kali ada copy baru, screenshot, atau item dihapus.
  ```json
  {
    "items": [
      { "id": "1", "type": "Image", ... },
      { "id": "2", "type": "Text", ... }
    ],
    "count": 3,
    "max": 5
  }
  ```
