# Tauri v2 Backend & Frontend Integration Contract (Adaptive 1–20 Items)

Panduan teknis langkah-demi-langkah bagi **Agen Backend** untuk mengimplementasikan fungsionalitas sistem agar sinkron dengan antarmuka Notch baru di [`frontend/design/notch_ui_spec.figcraft`](./design/notch_ui_spec.figcraft).

---

## 1. Konfigurasi Awal Window Tauri (`src-tauri/tauri.conf.json`)

Mengingat ukuran notch dapat mencapai `864 × 180 px`, batas maksimum ukuran window harus diatur fleksibel:

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Dynamic RAM Notch",
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

## 2. Dynamic Window Resizing (Rust Backend)

Karena ukuran Notch berubah secara dinamis mengikuti jumlah file di RAM ($N$ file terisi + 1 slot kosong), Backend menyediakan command yang menerima dimensi target dari Frontend atau menghitungnya langsung:

```rust
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[tauri::command]
fn set_notch_dimensions(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let monitor = window.current_monitor().map_err(|e| e.to_string())?.ok_or("No monitor")?;
        let screen_width = monitor.size().width as f64;
        let scale_factor = monitor.scale_factor();

        // Posisi X selalu presisi di tengah monitor
        let target_x = (screen_width - (width * scale_factor)) / 2.0;

        window.set_size(PhysicalSize::new(
            (width * scale_factor) as u32,
            (height * scale_factor) as u32,
        )).map_err(|e| e.to_string())?;

        // Posisi Y selalu menempel bezel atas monitor
        window.set_position(PhysicalPosition::new(target_x as i32, 0))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

---

## 3. Struktur Data FIFO RAM Buffer (Kapasitas Maksimal 20 Item)

Antrean memori RAM sekarang menampung hingga **20 item**:

```rust
use std::collections::VecDeque;
use serde::{Deserialize, Serialize};

pub const MAX_RAM_CAPACITY: usize = 20;

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

pub struct ClipboardState {
    pub queue: VecDeque<ClipboardItem>,
}

impl ClipboardState {
    pub fn push_new(&mut self, item: ClipboardItem) {
        // Item baru masuk di sisi kanan (push_back) atau indeks baru
        if self.queue.len() >= MAX_RAM_CAPACITY {
            // Hapus item tertua (paling kiri)
            self.queue.pop_front();
        }
        self.queue.push_back(item);
    }
}
```

---

## 4. Tauri IPC Endpoints

### A. Commands (Frontend ➔ Backend)
* `get_buffer() -> Vec<ClipboardItem>`: Mengambil seluruh item yang ada di antrean RAM.
* `set_notch_dimensions(width: f64, height: f64)`: Mengubah ukuran dan posisi horizontal window native.
* `delete_buffer_item(id: String)`: Menghapus item tertentu dari antrean (saat tombol `×` diklik).
* `start_drag(id: String)`: Memulai operasi OLE native drag-and-drop keluar jendela.

### B. Events (Backend ➔ Frontend)
* `buffer-updated`: Dipancarkan setiap kali ada copy baru, screenshot, atau file di-drop.
  ```json
  {
    "items": [
      { "id": "uuid-1", "type": "File", "data": { ... } },
      { "id": "uuid-2", "type": "Text", "data": { ... } }
    ],
    "count": 2,
    "max": 20
  }
  ```
