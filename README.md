# Dynamic RAM Notch 🏝️

> **Desktop Floating Clipboard & File Staging Utility** bergaya Apple Dynamic Island untuk Windows 10 & 11.  
> 100% Volatile in RAM — Zero Disk Footprint.

---

## ✨ Fitur Utama

- 🏝️ **Adaptive Dynamic Notch:** Menempel di bagian atas layar monitor, membesar dan menciut (*smooth elastic spring physics*) mengikuti kursor mouse.
- ⚡ **Zero Disk Footprint:** Seluruh data clipboard (teks, gambar, file) hanya disimpan di memori (RAM). Saat aplikasi ditutup, semua data langsung terhapus bersih.
- 🖐️ **Native Windows OLE Drag-Out:** Tarik (*drag*) file atau gambar langsung keluar dari Notch ke aplikasi apa pun (Word, browser, email, chat, folder explorer).
- 🤖 **Antigravity CLI & MCP Integration:** Terintegrasi langsung dengan Model Context Protocol (MCP) sehingga agent AI (seperti Antigravity) dapat menginspeksi clipboard buffer tanpa perlu copy-paste manual.
- 🔔 **Windows System Tray & Start Menu:** Terintegrasi di tray (pojok kanan bawah) dan terdaftar di Windows Search.

---

## 🚀 Cara Menjalankan (Pilih Salah Satu)

Anda dapat memilih cara penggunaan yang paling sesuai:

### Opsi 1: Menggunakan Installer `.exe` (Rekomendasi untuk Pengguna)
1. Jalankan **`Notch-Setup.exe`**.
2. Ikuti panduan instalasi (Next -> Finish).
3. Selesai! Anda tinggal menekan tombol `Windows` pada keyboard, ketik **"Notch"**, lalu tekan Enter.
4. Aplikasi akan langsung berjalan hening di background tanpa membuka jendela terminal/command prompt.

### Opsi 2: Menggunakan File Script `.bat` (Untuk Developer)
1. Pastikan Node.js dan Rust sudah terpasang.
2. Jalankan:
   ```cmd
   start-notch.bat
   ```
3. Script akan otomatis menyalakan backend daemon dan antarmuka desktop Notch.

---

## 🛠️ Arsitektur Teknologi

- **Frontend Layer:** React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion (Windowing via Electron).
- **Backend Daemon:** Rust in-memory FIFO queue + Win32 clipboard polling + tiny_http embedded server.
- **MCP Server:** Node.js JSON-RPC 2.0 stdio server untuk integrasi Antigravity CLI.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi [MIT License](./LICENSE).
