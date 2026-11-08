# Dynamic RAM Notch Clipboard Manager

## What This Is
A lightweight, background-running Windows utility that creates a dynamic notch at the top center of the screen. It acts as an in-memory (RAM-only) volatile clipboard and file staging shelf (FIFO queue, max 5 items), allowing users to capture clipboard data, hold drag-and-drop assets, and drag them out to target apps or access them via a local CLI endpoint.

## Core Value
Zero-disk-clutter, ultra-lightweight (<50MB RAM) clipboard and file staging at the screen edge with fluid dynamic-island interactions.

## Business & Context
- **Target User**: Power users, creators, multitaskers transferring text, screenshots, and files across apps.
- **Success Metric**: < 50MB RAM idle, instant clipboard ingestion, buttery smooth 60fps notch animations, reliable OLE drag-out to third-party Windows apps.

## Requirements

### Validated
(None yet — initial phase)

### Active
- [ ] In-Memory FIFO Queue (Ring buffer, capacity = 5 items, zero disk persistence)
- [ ] Windows Clipboard Listener (Win32 format listener for text and image bitmaps)
- [ ] Staging Ingress (Drag-and-drop file URI ingestion into the queue)
- [ ] Embedded Local HTTP Server (REST API on localhost for CLI/external polling)
- [ ] Tauri Window & System Tray Management (Frameless, transparent, always-on-top, skip taskbar)
- [ ] Native Drag-out Egress (OLE DoDragDrop to target applications)

### Out of Scope
- SQLite / Disk database persistence (violates RAM-only volatile staging philosophy)
- Heavy Electron runtime (too high RAM usage for 24/7 background utility)
- Cloud synchronization (all operations strictly local and volatile)

## Constraints
- **Platform**: Windows 10 & Windows 11 (x64)
- **Runtime**: Tauri v2 + WebView2
- **Memory Ceiling**: < 50MB RAM when idle, < 85MB under peak 5-screenshot load
- **Language**: Rust for backend core, TypeScript/React for frontend UI
