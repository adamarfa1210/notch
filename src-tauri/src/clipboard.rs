use crate::buffer::{FifoBuffer, StagedItem};
use arboard::{Clipboard, ImageData};
use image::{ImageBuffer, Rgba};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use uuid::Uuid;

pub type OnUpdateCallback = Arc<dyn Fn() + Send + Sync + 'static>;

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
}

impl ClipboardMonitor {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(&self, buffer: Arc<FifoBuffer>, poll_interval_ms: u64, on_update: Option<OnUpdateCallback>) {
        if self.running.swap(true, Ordering::SeqCst) {
            return;
        }

        let is_running = Arc::clone(&self.running);

        thread::spawn(move || {
            let mut clipboard = match Clipboard::new() {
                Ok(cb) => cb,
                Err(e) => {
                    eprintln!("[ClipboardMonitor] Failed to initialize system clipboard: {e}");
                    return;
                }
            };

            let mut last_hash: u64 = 0;

            while is_running.load(Ordering::Relaxed) {
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    // 1. Try reading text
                    if let Ok(text) = clipboard.get_text() {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() {
                            let hash = calculate_hash(&trimmed);
                            if hash != last_hash {
                                last_hash = hash;
                                let id = Uuid::new_v4().to_string();
                                buffer.push(StagedItem::new_text(id, trimmed.to_string()));
                                if let Some(ref cb) = on_update {
                                    cb();
                                }
                                return;
                            }
                        }
                    }

                    // 2. Try reading image/screenshot if no text was captured
                    if let Ok(img) = clipboard.get_image() {
                        let hash = calculate_image_hash(&img);
                        if hash != last_hash {
                            last_hash = hash;
                            if let Some(staged) = convert_image_to_staged(img) {
                                buffer.push(staged);
                                if let Some(ref cb) = on_update {
                                    cb();
                                }
                            }
                        }
                    }
                }));

                thread::sleep(Duration::from_millis(poll_interval_ms));
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

fn calculate_hash<T: Hash>(t: &T) -> u64 {
    let mut s = DefaultHasher::new();
    t.hash(&mut s);
    s.finish()
}

fn calculate_image_hash(img: &ImageData) -> u64 {
    let mut s = DefaultHasher::new();
    img.width.hash(&mut s);
    img.height.hash(&mut s);
    let bytes = &img.bytes;
    if bytes.len() > 512 {
        bytes[..256].hash(&mut s);
        bytes[bytes.len() - 256..].hash(&mut s);
    } else {
        bytes.hash(&mut s);
    }
    s.finish()
}

fn convert_image_to_staged(img: ImageData) -> Option<StagedItem> {
    let width = img.width as u32;
    let height = img.height as u32;

    // Safety checks: Reject invalid or huge uncompressed images to avoid OOM
    if width == 0 || height == 0 || width > 2560 || height > 1600 {
        return None;
    }

    let expected_len = (width as usize).saturating_mul(height as usize).saturating_mul(4);
    if img.bytes.len() != expected_len || img.bytes.len() > 8 * 1024 * 1024 {
        return None;
    }

    let img_buffer: ImageBuffer<Rgba<u8>, _> =
        ImageBuffer::from_raw(width, height, img.bytes.into_owned())?;

    let mut png_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut png_bytes);

    img_buffer
        .write_to(&mut cursor, image::ImageFormat::Png)
        .ok()?;

    use base64::engine::general_purpose::STANDARD;
    use base64::Engine;
    let base64_str = STANDARD.encode(&png_bytes);

    let id = Uuid::new_v4().to_string();
    Some(StagedItem::new_image(id, base64_str, width, height))
}
