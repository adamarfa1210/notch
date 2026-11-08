# Roadmap: Dynamic RAM Notch Clipboard Manager

## Overview
This roadmap structures the delivery of the Dynamic RAM Notch utility into clean, decoupled phases. Phase 1 delivers the complete backend engine (In-Memory FIFO Buffer, Win32 Clipboard Listener, and Embedded Local HTTP API). Phase 2 integrates the Tauri v2 window shell, system tray, and native drag-and-drop. Phase 3 hooks the frontend UI designed in Figcraft.

## Phases

- [ ] **Phase 1: Backend Core (Rust Engine)** - Thread-safe FIFO RAM buffer, Win32 clipboard monitor, and local HTTP REST server.
- [ ] **Phase 2: Tauri Shell & OS Integration** - Frameless transparent window management, System Tray, and OLE drag-out integration.
- [ ] **Phase 3: Frontend UI & Notch Micro-Interactions** - React/Tailwind/Framer Motion dynamic island UI connected to Tauri IPC.

## Phase Details

### Phase 1: Backend Core (Rust Engine)
**Goal**: Build the independent, robust backend module containing the in-memory FIFO queue, Windows clipboard event listener, and embedded localhost HTTP daemon for CLI integration.
**Depends on**: Nothing
**Requirements**: FIFO-01, FIFO-02, FIFO-03, FIFO-04, FIFO-05, CLIP-01, CLIP-02, CLIP-03, CLIP-04, HTTP-01, HTTP-02, HTTP-03, HTTP-04
**Success Criteria**:
  1. The FIFO queue stores up to 5 items in RAM with automated eviction of the 6th item.
  2. Windows clipboard copy actions (text and screenshots) are detected and ingested into the buffer within 100ms.
  3. `curl http://127.0.0.1:49152/api/items` returns the current buffer state as valid JSON.
  4. Non-trivial logic has unit tests proving thread safety and FIFO boundary handling.

Plans:
- [ ] 01-01: In-memory FIFO queue data structures, items enum, and unit test suite.
- [ ] 01-02: Win32 clipboard event listener with deduplication and image byte conversion.
- [ ] 01-03: Embedded local HTTP server (`tiny_http` / `axum`) exposing `/api/items` endpoints.

### Phase 2: Tauri Shell & OS Integration
**Goal**: Package the Rust engine into a Tauri v2 application with system tray, transparent frameless window, dynamic resizing, and OLE drag-out.
**Depends on**: Phase 1
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, EGR-01
**Success Criteria**:
  1. App boots silently into System Tray with minimal RAM footprint (<50MB).
  2. Window appears pinned at top-center, frameless and transparent.
  3. Window can switch between Collapsed and Expanded bounds via IPC.

### Phase 3: Frontend UI & Notch Micro-Interactions
**Goal**: Integrate the Figcraft frontend into the Tauri webview with fluid Framer Motion animations.
**Depends on**: Phase 2
**Requirements**: Staging thumbnails, delete triggers, hover expansion, drag-in/out visual cues.
