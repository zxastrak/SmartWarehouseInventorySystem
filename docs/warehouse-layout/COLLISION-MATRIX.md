# COLLISION MATRIX: WAREHOUSE LAYOUT

> **Dokumen Kebijakan Deteksi Tabrakan Antar Objek Layout (AABB 2D)**  
> Acuan Resmi untuk `layoutValidationService.js` dan Engine Canvas Top View.

---

## 1. Prinsip Dasar Geometri
1. **Satuan**: Seluruh koordinat dan dimensi dihitung dalam integer milimeter (`mm`).
2. **Definisi Irisan (Overlap)**:
   - **Tabrakan (Collision)**: Terjadi jika dan hanya jika luas perpotongan dua bounding box AABB bernilai positif (> 0).
   - **Edge-Touch (Sisi Berhimpit)**: Dua objek yang sisinya saling bersentuhan pas (luas irisan = 0) **diperbolehkan** dan **tidak dianggap bertabrakan**.
3. **Default Policy**: Objek dengan jenis baru atau tidak dikenal secara default **DITOLAK (REJECT)** untuk bertabrakan dengan entitas mana pun sampai kebijakannya didefinisikan secara eksplisit di dokumen ini.

---

## 2. Matriks Kebijakan Overlap Antar Objek

| Objek A \ Objek B | Rack (Rak) | Aisle (Lorong) | Wall (Dinding) | Pillar (Tiang) | Door (Pintu) | Dock (Loading Dock) | Zone (Zona) | Warehouse (Batas) |
|---|---|---|---|---|---|---|---|---|
| **Rack** | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ⚠️ Dalam Footprint | ⚠️ Wajib di Dalam |
| **Aisle** | ❌ Ditolak | ✅ Diizinkan (Interseksi) | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ⚪ Netral | ⚠️ Wajib di Dalam |
| **Wall** | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ⚪ Netral | ⚠️ Wajib di Dalam |
| **Pillar** | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ⚪ Netral | ⚠️ Wajib di Dalam |
| **Door** | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ⚪ Netral | ⚠️ Wajib di Dalam |
| **Dock** | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ⚪ Netral | ⚠️ Wajib di Dalam |
| **Zone** | ⚠️ Wajib Melingkupi | ⚪ Netral | ⚪ Netral | ⚪ Netral | ⚪ Netral | ⚪ Netral | ❌ Ditolak (Overlap) | ⚠️ Wajib di Dalam |

### Keterangan Simbol:
- ❌ **Ditolak**: Luas irisan positif (> 0) memicu error `GEOMETRY_CONFLICT` (`OVERLAP`).
- ✅ **Diizinkan**: Irisan diperbolehkan (misalnya persimpangan antar dua lorong / aisle intersection).
- ⚠️ **Wajib di Dalam / Dalam Footprint**: Objek anak harus berada 100% di dalam batas poligon/kotak induk (`inside(inner, outer) === true`). Jika keluar batas memicu `OUT_OF_BOUNDS` atau `ZONE_BREACH`.
- ⚪ **Netral**: Objek fisik boleh melintasi area logis tersebut (misalnya lorong melintasi zona).

---

## 3. Aturan Khusus Zonasi & Lorong
1. **Zona**: Zona tidak boleh saling bertumpukan / overlap dengan zona lain (`Zone vs Zone = Ditolak`).
2. **Rak di Dalam Zona**: Jika sebuah rak diberi `zone_id`, seluruh bounding box rak (setelah memperhitungkan rotasi 0/90/180/270) **wajib berada 100% di dalam area zona tersebut**.
3. **Batas Gudang**: Seluruh rak, lorong, rintangan, dan zona wajib berada 100% di dalam batas fisik gudang (`width_mm` dan `length_mm` warehouse).
4. **Lebar Minimum Lorong**: Lorong wajib memiliki lebar minimal (`width_mm >= 1500 mm`).
