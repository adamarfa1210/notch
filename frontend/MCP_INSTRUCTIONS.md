# Panduan FigCraft MCP untuk Agen AI

Dokumen ini berisi konfigurasi dan instruksi pemanggilan **FigCraft Model Context Protocol (MCP)** bagi agen AI (Antigravity, Claude Code, Cursor, atau agen backend) yang ingin membaca atau memodifikasi desain kanvas secara terprogram.

---

## 1. Konfigurasi MCP Server

Tambahkan blok berikut ke konfigurasi MCP client agen Anda:

### Opsi A: Mode Headless (Rekomendasi untuk Coding Agen)
Bekerja di latar belakang tanpa memerlukan jendela aplikasi FigCraft terbuka:

```json
{
  "mcpServers": {
    "figcraft": {
      "command": "C:\\Program Files\\ArtCraft\\FigCraft\\figcraft-cli.exe",
      "args": ["mcp"]
    }
  }
}
```

### Opsi B: Mode Live / Attached (Mengontrol Aplikasi yang Sedang Terbuka)
Terhubung langsung ke sesi FigCraft yang sedang berjalan di port `7979`:

```json
{
  "mcpServers": {
    "figcraft-live": {
      "command": "C:\\Program Files\\ArtCraft\\FigCraft\\figcraft-cli.exe",
      "args": ["mcp", "--attach", "7979"]
    }
  }
}
```

---

## 2. Tool MCP yang Sering Digunakan untuk Coding Front-end

| Tool | Fungsi | Penggunaan oleh Agen |
| :--- | :--- | :--- |
| `inspect_document` | Mengambil seluruh pohon elemen (*layer tree*) dalam format JSON. | Mengekstrak hierarki frame, teks, margin, padding, dan warna untuk dijadikan komponen React/Tailwind. |
| `get_node` | Mengambil detail spesifik satu node berdasarkan ID. | Mengetahui properti presisi seperti corner radius, stroke weight, font-size, dll. |
| `screenshot` | Mengambil cuplikan PNG dari seluruh halaman atau node tertentu. | Memberikan visual referensi langsung ke multimodal/vision AI model. |
| `export` | Mengekspor node/frame ke file SVG atau PNG. | Mengekstrak ikon atau aset grafis untuk dimasukkan ke folder project. |

---

## 3. Alternatif Tanpa MCP (Zero Dependency)

Jika agen backend Anda tidak menjalankan MCP server, agen dapat langsung membaca file representasi JSON yang sudah diekstrak:
* **JSON Layer Tree:** [`frontend/design/notch_ui_spec.json`](./design/notch_ui_spec.json)
* **Kontrak IPC Tauri:** [`frontend/TAURI_IPC_CONTRACT.md`](./TAURI_IPC_CONTRACT.md)
* **Spesifikasi CSS & Tokens:** [`frontend/DESIGN_SPEC.md`](./DESIGN_SPEC.md)
