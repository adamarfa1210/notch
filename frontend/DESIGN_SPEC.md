# Frontend Design Specification — Adaptive Dynamic RAM Notch (1–20 Files)

Dokumen ini merupakan panduan implementasi antarmuka (UI/UX) untuk tim Frontend berdasarkan arsitektur progresif adaptif (1 hingga 20 file).

---

## 🎨 Asset File & Desain

* **File Native FigCraft:** [`design/notch_ui_spec.figcraft`](./design/notch_ui_spec.figcraft)
* **File Resmi Figma:** [`design/notch_ui_spec.fig`](./design/notch_ui_spec.fig)
* **Pohon Layer JSON:** [`design/notch_ui_spec.json`](./design/notch_ui_spec.json)
* **Visual Export (PNG):** [`design/notch_ui_spec.png`](./design/notch_ui_spec.png)
* **Vector Graphic (SVG):** [`design/notch_ui_spec.svg`](./design/notch_ui_spec.svg)

---

## 📐 Logika Perkembangan & Ukuran Progresif

Sistem Notch mengadopsi rumus:  
$$\text{Total Slot Terbuka} = \text{Jumlah File di RAM} + 1 \text{ (Slot Kosong Dropzone)}$$

* **Aliran Item:** Item baru selalu mendarat di sisi kanan (sebelum slot kosong). Item yang lebih lama terdorong bergeser ke arah kiri.
* **Pertumbuhan Simetris:** Kontainer Notch selalu berada tepat di tengah layar horizontal ($\text{Posisi } X = \frac{\text{ScreenWidth} - \text{Width}}{2}$) dan melebar secara simetris ke kanan dan kiri.
* **Ukuran Kotak Slot:** Konstan `76 × 62 px` (tidak mengecil).

---

## 🖥️ Matriks State & Dimensi Notch

| State | File di RAM | Jumlah Slot | Baris | Lebar Notch | Tinggi Notch | Posisi Baris 2 |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Idle (Collapsed)** | Bebas | 0 | - | `140 px` | `12 px` | - |
| **Phase 1 (Kosong Hover)** | 0 | 1 | 1 | `124 px` | `96 px` | - |
| **Phase 2 (Sedang)** | 3 | 4 | 1 | `360 px` | `96 px` | - |
| **Phase 3 (Row 1 Penuh)** | 9 s/d 10 | 10 | 1 | `864 px` | `96 px` | - |
| **Phase 4 (Tier 2 Multi-Row)** | 11 s/d 20 | 11–20 | 2 | `864 px` | `180 px` | **Dimulai dari tengah (*center-aligned*)** |

---

## ⚡ Rumus Matematis Ukuran Window

### Rumus Lebar Baris 1:
$$\text{Width}(N_{\text{slots}}) = (N_{\text{slots}} \times 76) + ((N_{\text{slots}} - 1) \times 8) + 32$$

* Untuk 1 slot: $(1 \times 76) + 0 + 32 + 16 = 124\text{ px}$
* Untuk 4 slot: $(4 \times 76) + 24 + 32 = 360\text{ px}$
* Untuk 10 slot: $(10 \times 76) + 72 + 32 = 864\text{ px}$ (Lebar Maksimal)

### Rumus Tinggi Window:
* **Item $\le 10$ (1 Baris):** Tinggi = `96 px`
* **Item $11 - 20$ (2 Baris):** Tinggi = `180 px` (Notch melipat 2x ke bawah)

---

## 🧩 Contoh Implementasi Framer Motion (React)

```tsx
// frontend/src/components/Notch.tsx
import { motion } from "framer-motion";

interface NotchProps {
  itemCount: number;
  isHovered: boolean;
}

export const Notch = ({ itemCount, isHovered }: NotchProps) => {
  const isMultiRow = itemCount >= 10;
  const visibleSlots = Math.min(itemCount + 1, 20);
  
  // Hitung lebar dinamis
  const width = !isHovered 
    ? 140 
    : isMultiRow 
      ? 864 
      : Math.max(124, (visibleSlots * 76) + ((visibleSlots - 1) * 8) + 32);

  const height = !isHovered 
    ? 12 
    : isMultiRow 
      ? 180 
      : 96;

  return (
    <motion.div
      animate={{ width, height }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className="fixed top-0 bg-black/95 border border-sky-400 rounded-b-2xl overflow-hidden"
    >
      {/* Baris 1 */}
      <div className="flex gap-2 p-4">
        {/* Render 10 slot pertama */}
      </div>

      {/* Baris 2 (Center Aligned jika > 10) */}
      {isMultiRow && (
        <div className="flex justify-center gap-2 px-4 pb-4">
          {/* Render slot 11 hingga 20 */}
        </div>
      )}
    </motion.div>
  );
};
```
