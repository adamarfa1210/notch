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
1. **Initialize `src-tauri/Cargo.toml`**: Configure dependencies (`tiny_http`, `serde`, `serde_json`, `arboard`, `image`, `uuid`, etc.).
2. **Buffer Module (`src-tauri/src/buffer.rs`)**:
   - Data structures: `StagedItem`, `ItemPayload` (Text, Image, FileUri).
   - `FifoBuffer` with `RwLock<VecDeque<StagedItem>>`, capacity = 5.
   - Comprehensive unit tests verifying FIFO push, eviction, removal, and concurrency.
3. **Clipboard Monitor (`src-tauri/src/clipboard.rs`)**:
   - Background polling/event loop using `arboard`.
   - Content hashing to avoid duplicate ingress loops.
   - Image conversion to PNG base64.
4. **Embedded HTTP Server (`src-tauri/src/server.rs`)**:
   - `tiny_http` server on `127.0.0.1:49152`.
   - Routes: `/api/items`, `/api/items/latest`, `/api/items/<id>` (DELETE), `/health`.
5. **CLI / Daemon Entrypoint (`src-tauri/src/main.rs`)**:
   - Runs the buffer, starts clipboard listener thread, starts HTTP server thread.
6. **Verification & Tests**:
   - Run `cargo test` to verify all unit tests pass.
   - Start the daemon and run `curl http://127.0.0.1:49152/health` and clipboard ingestion checks.
