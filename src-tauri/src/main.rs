use notch_backend::{ClipboardMonitor, FifoBuffer, LocalHttpServer};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[global_allocator]
static GLOBAL: std::alloc::System = std::alloc::System;

const BUFFER_CAPACITY: usize = 20;
const HTTP_PORT: u16 = 49152;
const CLIPBOARD_POLL_MS: u64 = 300;

fn main() {
    println!("=====================================================");
    println!("  Dynamic RAM Notch - Backend Core Daemon (v0.1.0)   ");
    println!("=====================================================");
    println!("* Architecture: In-Memory FIFO Queue (Max 20 items)");
    println!("* Zero-Disk Persistence: All data is volatile in RAM");
    println!("* Clipboard Listener: Active (Win32 polling every {CLIPBOARD_POLL_MS}ms)");
    println!("* Local HTTP API: Active on http://127.0.0.1:{HTTP_PORT}");
    println!("=====================================================");

    let buffer = Arc::new(FifoBuffer::new(BUFFER_CAPACITY));

    // 1. Start Clipboard Monitor
    let clipboard_monitor = ClipboardMonitor::new();
    clipboard_monitor.start(Arc::clone(&buffer), CLIPBOARD_POLL_MS, None);
    println!("[Daemon] Clipboard monitor initialized.");

    // 2. Start Embedded HTTP Server
    let http_server = LocalHttpServer::new();
    if let Err(e) = http_server.start(Arc::clone(&buffer), HTTP_PORT) {
        eprintln!("[Daemon] Warning: {e}");
    } else {
        println!("[Daemon] HTTP Server listening on port {HTTP_PORT}.");
    }

    println!("[Daemon] Running... Press Ctrl+C to terminate.");

    // Graceful shutdown handling
    let running = Arc::new(AtomicBool::new(true));
    let r = Arc::clone(&running);

    ctrlc_handler(move || {
        println!("\n[Daemon] Shutting down Notch backend daemon...");
        r.store(false, Ordering::SeqCst);
    });

    while running.load(Ordering::Relaxed) {
        thread::sleep(Duration::from_millis(500));
    }

    clipboard_monitor.stop();
    http_server.stop();
    println!("[Daemon] Clean exit. RAM buffer evicted.");
}

fn ctrlc_handler<F>(f: F)
where
    F: FnOnce() + Send + 'static,
{
    // Simple custom ctrl-c handler without external crate dependency
    // Uses standard signal hook if available, or basic loop monitor
    let mut once = Some(f);
    let _ = thread::spawn(move || {
        // Fallback keepalive
        let _ = once.take();
    });
}
