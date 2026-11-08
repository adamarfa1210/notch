use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ItemType {
    Text,
    Image,
    FileUri,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StagedItem {
    pub id: String,
    pub item_type: ItemType,
    pub preview: String,
    pub data: String,
    pub mime: String,
    pub created_at: u64,
}

impl StagedItem {
    pub fn new_text(id: String, content: String) -> Self {
        let preview = if content.chars().count() > 60 {
            let truncated: String = content.chars().take(57).collect();
            format!("{truncated}...")
        } else {
            content.clone()
        };

        Self {
            id,
            item_type: ItemType::Text,
            preview,
            data: content,
            mime: "text/plain".to_string(),
            created_at: current_epoch_seconds(),
        }
    }

    pub fn new_image(id: String, base64_png: String, width: u32, height: u32) -> Self {
        Self {
            id,
            item_type: ItemType::Image,
            preview: format!("{width}x{height} PNG Image"),
            data: base64_png,
            mime: "image/png".to_string(),
            created_at: current_epoch_seconds(),
        }
    }

    pub fn new_file(id: String, file_path: String) -> Self {
        let file_name = std::path::Path::new(&file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file")
            .to_string();

        Self {
            id,
            item_type: ItemType::FileUri,
            preview: file_name,
            data: file_path,
            mime: "application/octet-stream".to_string(),
            created_at: current_epoch_seconds(),
        }
    }
}

pub struct FifoBuffer {
    items: RwLock<VecDeque<StagedItem>>,
    capacity: usize,
}

impl FifoBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            items: RwLock::new(VecDeque::with_capacity(capacity)),
            capacity,
        }
    }

    /// Pushes a new item to the front (index 0).
    /// If the queue exceeds capacity, the oldest item is evicted and returned.
    pub fn push(&self, item: StagedItem) -> Option<StagedItem> {
        let mut queue = self.items.write().unwrap();
        queue.push_front(item);

        if queue.len() > self.capacity {
            queue.pop_back()
        } else {
            None
        }
    }

    /// Returns a snapshot clone of all staged items (newest first).
    pub fn get_all(&self) -> Vec<StagedItem> {
        let queue = self.items.read().unwrap();
        queue.iter().cloned().collect()
    }

    /// Finds a single item by its ID.
    pub fn get_by_id(&self, id: &str) -> Option<StagedItem> {
        let queue = self.items.read().unwrap();
        queue.iter().find(|item| item.id == id).cloned()
    }

    /// Removes an item by its ID. Returns true if an item was found and removed.
    pub fn remove_by_id(&self, id: &str) -> bool {
        let mut queue = self.items.write().unwrap();
        if let Some(pos) = queue.iter().position(|item| item.id == id) {
            queue.remove(pos);
            true
        } else {
            false
        }
    }

    /// Clears all items in the buffer.
    pub fn clear(&self) {
        let mut queue = self.items.write().unwrap();
        queue.clear();
    }

    /// Current count of items in the buffer.
    pub fn len(&self) -> usize {
        let queue = self.items.read().unwrap();
        queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

fn current_epoch_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_fifo_capacity_and_eviction() {
        let buffer = FifoBuffer::new(5);

        for i in 1..=5 {
            let item = StagedItem::new_text(i.to_string(), format!("Content {i}"));
            let evicted = buffer.push(item);
            assert!(evicted.is_none());
        }

        assert_eq!(buffer.len(), 5);
        let items = buffer.get_all();
        assert_eq!(items[0].id, "5");
        assert_eq!(items[4].id, "1");

        // Push 6th item -> should evict item "1"
        let item6 = StagedItem::new_text("6".to_string(), "Content 6".to_string());
        let evicted = buffer.push(item6);

        assert!(evicted.is_some());
        assert_eq!(evicted.unwrap().id, "1");
        assert_eq!(buffer.len(), 5);

        let items_after = buffer.get_all();
        assert_eq!(items_after[0].id, "6");
        assert_eq!(items_after[4].id, "2");
    }

    #[test]
    fn test_remove_by_id() {
        let buffer = FifoBuffer::new(5);
        buffer.push(StagedItem::new_text("a".to_string(), "Item A".to_string()));
        buffer.push(StagedItem::new_text("b".to_string(), "Item B".to_string()));
        buffer.push(StagedItem::new_text("c".to_string(), "Item C".to_string()));

        assert_eq!(buffer.len(), 3);
        assert!(buffer.remove_by_id("b"));
        assert_eq!(buffer.len(), 2);

        let items = buffer.get_all();
        assert_eq!(items[0].id, "c");
        assert_eq!(items[1].id, "a");

        // Removing non-existent returns false
        assert!(!buffer.remove_by_id("non-existent"));
    }

    #[test]
    fn test_clear() {
        let buffer = FifoBuffer::new(5);
        buffer.push(StagedItem::new_text("1".to_string(), "Item 1".to_string()));
        buffer.clear();
        assert_eq!(buffer.len(), 0);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_thread_concurrency() {
        let buffer = Arc::new(FifoBuffer::new(5));
        let mut handles = vec![];

        for t in 0..10 {
            let buf_clone = Arc::clone(&buffer);
            handles.push(thread::spawn(move || {
                for i in 0..10 {
                    let id = format!("{t}-{i}");
                    buf_clone.push(StagedItem::new_text(id.clone(), format!("Thread text {id}")));
                }
            }));
        }

        for h in handles {
            h.join().unwrap();
        }

        // Must still respect capacity limit
        assert_eq!(buffer.len(), 5);
    }
}
