# Sistem E-Voting & Pengajuan Calon Ketua RT 06 / RW 10
**Perumahan Nuansa Alam Cilebut • Periode 2026-2031**

Aplikasi web pemilihan ketua RT berbasis mobile-first, ringan, dan siap di-hosting gratis di **Netlify** atau **GitHub Pages**. Seluruh data disimpan rapi dalam **1 file Google Sheets** milik Panitia.

---

## 📁 Struktur File

```text
evoting-rt06/
├── index.html              # Halaman Portal Utama (pintu masuk warga)
├── usulan.html             # Tahap 3 Part 1: Form Pengajuan Nama Calon
├── voting.html             # Tahap 3 Part 2: Halaman E-Voting Calon
├── livecount.html          # Dashboard Live Count Real-Time (untuk warga)
├── admin.html              # Panel Khusus Panitia (password protected)
├── data-rumah-contoh.csv   # Contoh template daftar rumah dan kuota suara
├── assets/
│   ├── config.js           # Konfigurasi URL Google Apps Script
│   ├── app.js              # Helper logika frontend bersama
│   ├── admin.js            # Logika panel admin panitia
│   └── style.css           # Tampilan UI modern & responsif (sesuai mockup)
└── apps-script/
    └── Code.gs             # Backend Google Apps Script (database di Google Sheets)
```

---

## 🚀 Panduan Setup Langkah Demi Langkah

### Langkah 1: Buat Backend di Google Sheets (Hanya Sekali)

1. Buka [Google Sheets](https://sheets.new) di browser Anda dengan akun Google panitia.
2. Beri nama file, misalnya: **Data Pemilihan RT 06 RW 10**.
3. Di menu atas, klik **Extensions (Ekstensi)** > **Apps Script**.
4. Hapus semua teks yang ada di editor Apps Script, lalu buka file `apps-script/Code.gs` di project ini, salin seluruh kodenya, dan tempelkan ke editor Apps Script.
5. Klik ikon **Save** (💾).
6. Di menu dropdown fungsi (sebelah tombol *Run/Jalankan*), pilih fungsi **`setup`**, lalu klik tombol **Run (Jalankan)**:
   - Google akan meminta izin (*Authorization Required*). Klik **Review permissions** > pilih akun Google Anda > klik **Advanced** > klik **Go to Untitled project (unsafe)** > klik **Allow**.
   - Setelah selesai, kembali ke tab Google Sheets Anda. Anda akan melihat sheet otomatis terbentuk: `Rumah`, `Usulan`, `Calon`, `Suara`, dan `Setting`.

---

### Langkah 2: Deploy Web App & Dapatkan URL API

1. Masih di halaman Apps Script, klik tombol biru **Deploy** di kanan atas > pilih **New deployment**.
2. Klik ikon gear ⚙️ di sebelah *Select type*, pilih **Web app**.
3. Isi form berikut:
   - **Description**: `API Pemilihan RT 06`
   - **Execute as**: `Me (email anda)`
   - **Who has access**: **`Anyone`** *(Penting: pilih Anyone agar browser warga bisa mengirim form tanpa harus login Google).*
4. Klik **Deploy**.
5. Salin teks yang ada di bagian **Web app URL** (bentuknya: `https://script.google.com/macros/s/AKfycb.../exec`).

---

### Langkah 3: Sambungkan Website ke Google Sheets

1. Buka file `assets/config.js` di folder `evoting-rt06`.
2. Ganti tulisan `PASTE_URL_WEB_APP_DI_SINI` dengan URL yang baru saja disalin:
   ```javascript
   window.APP_CONFIG = {
     API_URL: "https://script.google.com/macros/s/AKfycb.../exec",
     LIVE_REFRESH_MS: 10000,
     STORAGE_PREFIX: "rt06rw10_2026_",
   };
   ```
3. Simpan file `config.js`.

---

### Langkah 4: Masuk ke Panel Admin & Atur Password

1. Buka file `admin.html` di browser Anda (bisa klik ganda langsung di laptop).
2. Password default adalah: **`ganti-password-ini`**.
3. Setelah masuk:
   - Buka menu **Pengaturan**.
   - Masukkan password baru panitia yang aman pada kolom **Ganti Password Admin**, lalu klik **Simpan Pengaturan**.

---

### Langkah 5: Masukkan Data Rumah Warga

Ada 2 cara mudah:
- **Cara A (Melalui Panel Admin Website):**
  - Masuk ke menu **Data Rumah** di `admin.html`.
  - Masukkan daftar rumah per baris dengan format: `NOMOR_RUMAH, KUOTA` (contoh: `A1, 2` atau `B3, 1`). Anda bisa langsung salin-tempel dari file Excel panitia atau dari `data-rumah-contoh.csv`.
  - Klik **Simpan Data Rumah**.
- **Cara B (Langsung di Google Sheets):**
  - Buka file Google Sheets panitia, buka tab sheet **Rumah**.
  - Isi kolom A dengan Nomor Rumah (misal `A1`, `A2`) dan kolom B dengan angka `1` atau `2`.

---

## 🗳️ Alur Penggunaan Pemilihan

### 1. Tahap 3 Part 1: Pengajuan Nama Calon
1. Panitia membuka saklar **Part 1** di panel admin (atau jadwalkan otomatis di menu Pengaturan).
2. Bagikan link `usulan.html` (atau halaman utama `index.html`) ke grup WhatsApp warga.
3. Warga mengisi **Nomor Rumah** dan **Nama Calon yang Diajukan** (contoh saran format: *Jefri Nichol - Z1*).
4. Setiap nomor rumah hanya dapat mengajukan usulan maksimal sesuai kuota rumahnya (1 atau 2 kali).
5. Rekap usulan **hanya bisa dilihat oleh Panitia** di panel admin menu **Rekap Usulan (Part 1)**.

### 2. Seleksi 3-4 Calon oleh Panitia
1. Setelah Part 1 ditutup, panitia membuka menu **Rekap Usulan (Part 1)** di panel admin.
2. Jika ada nama calon yang sama tapi ditulis berbeda (misal *"Pak Jefri"* dan *"Jefri Nichol - Z1"*), gunakan tombol **+ Gabungkan** untuk menyatukannya.
3. Centang 3 sampai 4 nama calon dengan usulan terbanyak.
4. Klik tombol **Tetapkan Calon untuk Part 2**.
5. Di menu **Kelola Calon**, panitia bisa menambahkan visi/tagline singkat atau link foto calon (opsional).

### 3. Tahap 3 Part 2: E-Voting & Live Count
1. Panitia mengaktifkan saklar **Part 2** di panel admin.
2. Bagikan link `voting.html` dan `livecount.html` ke warga.
3. Warga memasukkan **Nomor Rumah**, memilih 1 calon di kartu suara, lalu mengonfirmasi pilihan.
4. **Pembatasan ganda:**
   - 1 perangkat/HP hanya bisa memberikan suara 1 kali.
   - Total suara dari 1 rumah dibatasi sesuai kuota (1 atau 2 suara).
5. Perolehan suara tampil transparan di **Live Count** (`livecount.html`) yang otomatis diperbarui secara berkala.
6. Pilihan spesifik calon pemilih **dirahasiakan** (tidak ditampilkan di admin maupun audit log demi menjaga asas Luber Jurdil).

### 4. Pengaturan Menu Halaman Utama (index.html)
- Halaman depan `index.html` **tidak langsung menampilkan semua pilihan sekaligus**.
- Panitia dapat mengatur menu mana saja yang muncul untuk warga melalui Panel Admin (di tab **Dashboard** maupun **Pengaturan**):
  - **Tahap Pengajuan (Part 1):** Cukup aktifkan Part 1 atau klik tombol **"Set Standar Part 1"** (hanya menu pengajuan yang muncul).
  - **Tahap E-Voting (Part 2):** Ketika Part 2 dibuka atau klik tombol **"Set Standar Part 2"**, menu E-Voting dan Live Count otomatis muncul bersamaan.
  - Panitia juga dapat mencentang/menonaktifkan masing-masing menu secara bebas kapan saja.

### 5. Fitur Reset Data Uji Coba (Simulasi Selesai)
- Sebelum pemilihan resmi dimulai, panitia biasanya melakukan uji coba pengajuan dan voting.
- Di panel admin (pada tab **Dashboard** tombol `⚠️ Reset Data Uji Coba` maupun di bagian bawah tab **Pengaturan**), tersedia fitur **Reset Data Pemilihan**.
- **Apa yang terjadi saat tombol reset ditekan:**
  1. Data **Suara Masuk (Part 2)** dan data **Usulan Calon (Part 1)** akan dikosongkan.
  2. Data **Nomor Rumah & Kuota TETAP AMAN dan TIDAK AKAN HILANG**.
  3. **Batasan 1 Device/HP Otomatis Terbuka Kembali:** Sistem secara cerdas memperbarui versi sesi, sehingga seluruh HP/laptop yang sebelumnya sudah dipakai untuk voting uji coba akan langsung diizinkan memilih lagi tanpa perlu hapus cache/history browser secara manual.

---

## 🌐 Cara Publish / Hosting Gratis

### Pilihan 1: Netlify Drop (Paling Mudah, 1 Menit)
1. Buka [app.netlify.com/drop](https://app.netlify.com/drop).
2. Tarik dan lepas (drag & drop) seluruh folder `evoting-rt06` ke dalam kotak di layar Netlify.
3. Netlify akan langsung memberikan alamat website online yang bisa diakses dari HP semua warga (contoh: `https://pemilihan-rt06-cilebut.netlify.app`).

### Pilihan 2: GitHub Pages
1. Buat repository baru di GitHub, misalnya `evoting-rt06`.
2. Unggah semua file di dalam folder `evoting-rt06` ke repository tersebut.
3. Buka tab **Settings** di repository > menu **Pages** (di sebelah kiri).
4. Di bagian *Branch*, pilih **main** atau **master**, lalu klik **Save**.
5. Website Anda aktif di `https://username.github.io/evoting-rt06/`.
