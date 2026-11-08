# Plan 01-01: Backend Core Engine (In-Memory FIFO, Clipboard Monitor, Local HTTP Server)

## Goal
Implement a clean, robust, anti-slop Rust backend crate in `src-tauri/` containing:
1. Thread-safe in-memory FIFO queue (max 5 items, zero disk persistence).
2. Windows clipboard listener with text and image capture + deduplication.
3. Embedded lightweight HTTP server (`tiny_http`) on `127.0.0.1:49152` for CLI and external integration.
4. Unit tests proving FIFO eviction, thread safety, and payload integrity.

## Requirements Covered
- FIFO-01, FIFO-02, FIFO-03, FIFO-04, FIFO-05
- CLIP-01, CLIP-02, CLIP-03, CLIP-04
- HTTP-01, HTTP-02, HTTP-03, HTTP-04

## Task Breakdown
- [x] **Initialize `src-tauri/Cargo.toml`**: Configured dependencies (`tiny_http`, `serde`, `serde_json`, `arboard`, `image`, `uuid`, etc.).
- [x] **Buffer Module (`src-tauri/src/buffer.rs`)**:
  - Implemented `StagedItem`, `ItemType` (Text, Image, FileUri).
  - Implemented `FifoBuffer` with `RwLock<VecDeque<StagedItem>>`, capacity = 5.
  - Implemented 4 comprehensive unit tests (eviction, ID deletion, clearing, concurrency).
- [x] **Clipboard Monitor (`src-tauri/src/clipboard.rs`)**:
  - Background polling loop with `arboard`.
  - Fast hash deduplication to avoid repetitive ingress.
  - In-memory RGBA to PNG Base64 converter.
- [x] **Embedded HTTP Server (`src-tauri/src/server.rs`)**:
  - `tiny_http` server on `127.0.0.1:49152`.
  - Routes: `/health`, `/api/items`, `/api/items/latest`, `/api/items/<id>` (DELETE), `/api/items` (POST).
- [x] **CLI / Daemon Entrypoint (`src-tauri/src/main.rs`)**:
  - Runs daemon, connects buffer, clipboard monitor, and HTTP server.
- [x] **Verification & Tests**:
  - `cargo test`: 4 passed (100% pass rate).
  - Integration verified via live HTTP requests to `/health`, `/api/items`, `/api/items/latest`, and `/api/items/:id`.

## Verdict
COMPLETED & VERIFIED
