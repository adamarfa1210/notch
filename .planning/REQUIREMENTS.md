# Requirements: Dynamic RAM Notch Clipboard Manager

**Defined:** 2026-11-08  
**Core Value:** Zero-disk-clutter, ultra-lightweight (<50MB RAM) clipboard and file staging at the screen edge with fluid dynamic-island interactions.

## v1 Requirements

### 1. In-Memory Buffer (FIFO)
- [ ] **FIFO-01**: In-memory ring buffer (VecDeque) with a maximum capacity of 5 items.
- [ ] **FIFO-02**: Automatic eviction of the oldest item when a 6th item arrives.
- [ ] **FIFO-03**: Support 3 item types: `Text(String)`, `Image(Vec<u8>, mime)`, `FileUri(String)`.
- [ ] **FIFO-04**: Individual item manual deletion by ID.
- [ ] **FIFO-05**: Thread-safe access across clipboard thread, HTTP server thread, and Tauri IPC.

### 2. Clipboard Ingress
- [ ] **CLIP-01**: Background Win32 clipboard format listener (`AddClipboardFormatListener`).
- [ ] **CLIP-02**: Capture plain text copies and push to FIFO.
- [ ] **CLIP-03**: Capture bitmap/image/screenshot copies, convert to PNG byte buffer, and push to FIFO.
- [ ] **CLIP-04**: Debounce duplicate clipboard events (ignore re-broadcast of identical hashes).

### 3. Local CLI HTTP API
- [ ] **HTTP-01**: Embedded local HTTP server listening on `127.0.0.1:49152`.
- [ ] **HTTP-02**: `GET /api/items` returns JSON array of all staged items with metadata.
- [ ] **HTTP-03**: `GET /api/items/latest` returns the newest item payload for CLI piping.
- [ ] **HTTP-04**: `DELETE /api/items/:id` removes a staged item from the queue.

### 4. Tauri Window & Tray Shell
- [ ] **SHELL-01**: Frameless, transparent, `always-on-top`, top-center pinned window.
- [ ] **SHELL-02**: System Tray icon with menu (Open, Clear Buffer, Exit).
- [ ] **SHELL-03**: Window resizing command between Collapsed (~140x12px) and Expanded (~420x90px).
- [ ] **SHELL-04**: `skip_taskbar: true` to prevent cluttering Windows Alt+Tab and taskbar.

### 5. Native Egress (Drag-Out)
- [ ] **EGR-01**: Drag-out item from UI to external Windows apps (File Explorer, Chat apps) via native OLE drag.

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| FIFO-01, FIFO-02, FIFO-03, FIFO-04, FIFO-05 | Phase 1 (Backend Core) | Pending |
| CLIP-01, CLIP-02, CLIP-03, CLIP-04 | Phase 1 (Backend Core) | Pending |
| HTTP-01, HTTP-02, HTTP-03, HTTP-04 | Phase 1 (Backend Core) | Pending |
| SHELL-01, SHELL-02, SHELL-03, SHELL-04 | Phase 2 (Tauri Integration & Shell) | Pending |
| EGR-01 | Phase 2 (Tauri Integration & Shell) | Pending |
