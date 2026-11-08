# Frontend Design Specification — Dynamic RAM Notch

Dokumen ini merupakan panduan implementasi antarmuka (UI/UX) untuk tim Frontend berdasarkan kebutuhan di [PRD.md](../PRD.md) dan [TECHSTACK.md](../TECHSTACK.md).

---

## 🎨 Asset File & Desain

* **File Native FigCraft/Figma:** [`design/notch_ui_spec.figcraft`](./design/notch_ui_spec.figcraft)
* **Visual Export (PNG):** [`design/notch_ui_spec.png`](./design/notch_ui_spec.png)

---

## 📐 Dua State Utama Antarmuka

### 1. State A: Idle / Collapsed Notch (Pill Tipis)
Menempel di bagian paling atas tengah layar Windows (`Y = 0`, `X = center`). Bersifat non-intrusive dan tidak menghalangi interaksi aplikasi lain di bawahnya.

* **Dimensi:** `Lebar: 140px`, `Tinggi: 12px`
* **Border Radius:** `0px 0px 8px 8px` (hanya membulat di sudut bawah)
* **Background:** `#000000` (atau obsidian dark) dengan stroke halus `#1E293B`
* **Status RAM Indicator:** Titik hijau/cyan halus (`#34D399`, diameter 4px) di tengah untuk menandakan background clipboard buffer aktif.

### 2. State B: Hover / Expanded Notch (Staging Shelf)
Muncul saat mouse diarahkan ke area notch atas. Menampilkan antrean 5 slot FIFO (*First-In, First-Out*).

* **Dimensi:** `Lebar: 440px`, `Tinggi: 96px`
* **Border Radius:** `0px 0px 16px 16px`
* **Background:** Deep dark translucency (`#000000` / `#0B0F19`) dengan border aksen aktif (`#38BDF8`).
* **Header Status:** Teks indikator kapasitas antrean RAM (`RAM BUFFER FIFO 3/5`) & petunjuk gestur.
* **5 Thumbnail Slots:**
  * **Ukuran Slot:** `76px × 62px` (masing-masing bersudut 8px, background `#1E293B`).
  * **Slot Terisi (Index 0 s/d 2):** Menampilkan preview visual (gambar/screenshot, text snippet, atau icon file) + badge tipe data + tombol `x` (hapus) merah/abu di pojok kanan atas.
  * **Slot Kosong (Index 3 s/d 4):** Kotak outline dengan ikon `+` redup (`#4B5563`).

---

## ⚡ Implementasi Frontend (React + Tailwind + Framer Motion)

```tsx
// Contoh transisi Framer Motion antara Collapsed & Expanded State
const notchVariants = {
  collapsed: {
    width: 140,
    height: 12,
    borderRadius: "0px 0px 8px 8px",
    transition: { type: "spring", stiffness: 400, damping: 30 }
  },
  expanded: {
    width: 440,
    height: 96,
    borderRadius: "0px 0px 16px 16px",
    transition: { type: "spring", stiffness: 350, damping: 25 }
  }
};
```
