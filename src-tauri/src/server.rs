use crate::buffer::{FifoBuffer, StagedItem};
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tiny_http::{Header, Method, Response, Server, StatusCode};
use uuid::Uuid;

pub struct LocalHttpServer {
    running: Arc<AtomicBool>,
}

#[derive(Deserialize)]
struct CreateItemRequest {
    item_type: String, // "text" or "file"
    content: String,
}

impl LocalHttpServer {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(&self, buffer: Arc<FifoBuffer>, port: u16) -> Result<(), String> {
        let addr = format!("127.0.0.1:{port}");
        let server = Server::http(&addr).map_err(|e| format!("Failed to bind HTTP server to {addr}: {e}"))?;

        self.running.store(true, Ordering::SeqCst);
        let is_running = Arc::clone(&self.running);

        thread::spawn(move || {
            println!("[HttpServer] Notch local API listening on http://{addr}");

            for mut request in server.incoming_requests() {
                if !is_running.load(Ordering::Relaxed) {
                    break;
                }

                let url = request.url().to_string();
                let method = request.method().clone();

                match (&method, url.as_str()) {
                    // 1. Health check
                    (&Method::Get, "/health") => {
                        let body = r#"{"status":"ok","app":"notch","version":"0.1.0"}"#;
                        let _ = request.respond(json_response(StatusCode(200), body));
                    }

                    // 2. Get all staged items (FIFO queue snapshot)
                    (&Method::Get, "/api/items") => {
                        let items = buffer.get_all();
                        let json = serde_json::to_string(&items).unwrap_or_else(|_| "[]".to_string());
                        let _ = request.respond(json_response(StatusCode(200), &json));
                    }

                    // 3. Get latest item
                    (&Method::Get, "/api/items/latest") => {
                        let items = buffer.get_all();
                        if let Some(latest) = items.first() {
                            let json = serde_json::to_string(latest).unwrap_or_else(|_| "{}".to_string());
                            let _ = request.respond(json_response(StatusCode(200), &json));
                        } else {
                            let _ = request.respond(json_response(
                                StatusCode(404),
                                r#"{"error":"Buffer is empty"}"#,
                            ));
                        }
                    }

                    // 4. Manually post item into buffer (CLI / external push)
                    (&Method::Post, "/api/items") => {
                        let mut content = Vec::new();
                        let body_len = request.body_length();
                        let mut reader = request.as_reader();
                        if let Some(len) = body_len {
                            content.resize(len, 0);
                            let _ = std::io::Read::read_exact(&mut reader, &mut content);
                        } else {
                            let _ = std::io::Read::read_to_end(&mut reader, &mut content);
                        }

                        if let Ok(req) = serde_json::from_slice::<CreateItemRequest>(&content) {
                            let id = Uuid::new_v4().to_string();
                            let item = match req.item_type.to_lowercase().as_str() {
                                "file" => StagedItem::new_file(id, req.content),
                                _ => StagedItem::new_text(id, req.content),
                            };
                            buffer.push(item);
                            let _ = request.respond(json_response(
                                StatusCode(201),
                                r#"{"status":"created"}"#,
                            ));
                        } else {
                            let _ = request.respond(json_response(
                                StatusCode(400),
                                r#"{"error":"Invalid JSON payload. Expected { item_type, content }"}"#,
                            ));
                        }
                    }

                    // 5. Delete item by ID
                    (&Method::Delete, path) if path.starts_with("/api/items/") => {
                        let id = &path["/api/items/".len()..];
                        if buffer.remove_by_id(id) {
                            let _ = request.respond(json_response(
                                StatusCode(200),
                                r#"{"deleted":true}"#,
                            ));
                        } else {
                            let _ = request.respond(json_response(
                                StatusCode(404),
                                r#"{"error":"Item not found"}"#,
                            ));
                        }
                    }

                    // 6. Clear entire buffer
                    (&Method::Post, "/api/items/clear") => {
                        buffer.clear();
                        let _ = request.respond(json_response(
                            StatusCode(200),
                            r#"{"status":"cleared"}"#,
                        ));
                    }

                    // 404 Fallback
                    _ => {
                        let _ = request.respond(json_response(
                            StatusCode(404),
                            r#"{"error":"Not found"}"#,
                        ));
                    }
                }
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

fn json_response(status: StatusCode, body: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut resp = Response::from_string(body).with_status_code(status);
    if let Ok(h) = Header::from_bytes(&b"Content-Type"[..], &b"application/json; charset=utf-8"[..]) {
        resp.add_header(h);
    }
    if let Ok(h) = Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]) {
        resp.add_header(h);
    }
    if let Ok(h) = Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, DELETE, OPTIONS"[..]) {
        resp.add_header(h);
    }
    if let Ok(h) = Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type"[..]) {
        resp.add_header(h);
    }
    resp
}
