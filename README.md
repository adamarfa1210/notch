# Dynamic RAM Notch 🏝️

> **Desktop Floating Clipboard & File Staging Utility** with Apple Dynamic Island aesthetics for Windows 10 & 11.  
> 100% Volatile in RAM — Zero-Disk Footprint.

---

## ✨ Features

- 🏝️ **Adaptive Dynamic Island Notch:** Floats seamlessly at the top center of your display, dynamically morphing and expanding (*smooth elastic spring physics*) as your cursor approaches.
- ⚡ **Zero-Disk Persistence (RAM Only):** All staged clipboard items (text, raw images, files) live exclusively in volatile RAM. As soon as Notch is closed, memory is evicted with zero trace on disk.
- 🖐️ **Native Windows OLE Drag-and-Drop:** Drag staged files, documents, Base64 images, or code snippets directly out of the Notch into any external application (Discord, WhatsApp, Word, Slack, Browser, or File Explorer).
- 🤖 **Antigravity CLI & MCP Integration:** Native Model Context Protocol (MCP) server integration (`notch-mcp.cjs`), allowing AI coding agents (such as Google Antigravity CLI) to inspect, read, and analyze your staged clipboard assets automatically.
- 🔔 **Windows System Tray & Search Integration:** Silent background operation with System Tray controls and instant indexing in Windows Search.

---

## 🚀 Getting Started (Choose Your Preferred Method)

You can run Notch using either the ready-to-run installer or the developer source script:

### Option 1: Windows Installer `.exe` (Recommended for End-Users)
1. Download or launch **`Notch-Setup.exe`**.
2. Follow the setup wizard (Next -> Install -> Finish).
3. Once installed, simply press the `Windows` key, type **"Notch"**, and press Enter.
4. Notch launches silently in the background with **zero terminal windows or console spam**. The island will appear at the top of your screen, and the tray icon will sit near your clock.

### Option 2: Run via `.bat` Script (For Developers / From Source)
1. Ensure **Node.js (>= 18)** and **Rust toolchain** are installed.
2. Clone this repository:
   ```bash
   git clone https://github.com/adamarfa1210/notch.git
   cd notch
   ```
3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```
4. Launch via the batch script:
   ```cmd
   start-notch.bat
   ```
   *(Or on PowerShell: `./start-notch.ps1`)*

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies | Role |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, TypeScript, Tailwind CSS, Framer Motion, Electron | Frameless, transparent, always-on-top morphing island with spring physics. |
| **Backend Core Daemon** | Rust, Win32 API (`arboard`, `tiny_http`, `uuid`) | High-performance, lightweight in-memory FIFO queue (max 20 items) and local HTTP REST server (`127.0.0.1:49152`). |
| **AI Agent Bridge** | Node.js (JSON-RPC 2.0 stdio) | Model Context Protocol (MCP) server enabling AI assistants to inspect staged clipboard assets. |

---

## 🔒 Security & Privacy

- **Local Loopback Only:** The embedded HTTP API exclusively binds to `127.0.0.1` — never exposed to local networks (LAN) or the internet.
- **Strict Privacy:** Zero telemetry, zero external API keys, zero cloud dependencies. Your data never leaves your local RAM.
- **Navigation Guard:** Built-in Electron guards block arbitrary URL navigation or unwanted popups.

---

## 📄 License

Distributed under the [MIT License](./LICENSE).
