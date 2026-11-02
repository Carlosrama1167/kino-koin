# Backend KINO Laundry POS

Dokumentasi arsitektur, endpoint, skema data, dan alur fitur berdasarkan implementasi saat ini tersedia di [`docs/architecture-and-flows.md`](docs/architecture-and-flows.md).

## Prasyarat

- PHP 8.1+ dengan ekstensi `pdo_pgsql`
- PostgreSQL
- Node.js/npm (untuk antarmuka React)

## Menyiapkan database

1. Buat database PostgreSQL bernama `kino_koin`.
2. Salin `.env.example` menjadi `.env`, lalu isi kredensial PostgreSQL lokal.
3. Jalankan `database/schema.sql`, lalu `database/seed.sql` pada database tersebut.
4. Buat akun pertama dari terminal: `php api/scripts/create_user.php`. Buat Owner terlebih dahulu, lalu akun Kasir/Karyawan. Kata sandi hanya disimpan sebagai hash.

Contoh menggunakan psql: `psql -U postgres -d kino_koin -f database/schema.sql` lalu `psql -U postgres -d kino_koin -f database/seed.sql`.

Untuk database yang sudah berjalan, terapkan migration yang belum dijalankan sesuai urutan nama file: `20261102_001_self_service_line_weights.sql`, lalu `20261102_002_membership_and_dropoff_dry.sql`. Schema baru sudah menyertakan perubahan tersebut; migration tidak dijalankan otomatis oleh aplikasi. Fitur Membership di UI/API memerlukan kedua migration pada database existing.

## Menjalankan aplikasi lokal

Buka dua terminal di folder proyek:

- Backend: `php -S 127.0.0.1:8000 -t api/public api/public/index.php`
- Frontend: `npm run dev`

Buka alamat Vite yang ditampilkan. Frontend meneruskan `/api` ke server PHP. Login memakai username/email dan password akun yang dibuat di atas. Hak akses menentukan halaman Owner, Kasir, atau Absensi. Kasir perlu membuka shift sebelum transaksi.

## Struktur frontend

- `src/main.jsx`: entry Vite, pemuat stylesheet berurutan, dan render root aplikasi.
- `src/app/Root.jsx`: pemulihan sesi dan pemilihan tampilan berdasarkan role.
- `src/features/auth/`: halaman login bersama.
- `src/features/owner/`: halaman Owner dan modul yang terhubung ke API.
- `src/features/employee/`: halaman absensi karyawan.
- `src/features/cashier/`: shell Kasir, halaman operasional, data UI, dan stylesheet Kasir.
- `src/shared/api.js`: helper komunikasi API bersama; `src/shared/styles/` berisi stylesheet entry dan tipografi lintas role.
- `src/style.css`: stylesheet dasar yang masih memuat aturan aplikasi lintas halaman.
- `src/features/*/styles/`: stylesheet khusus fitur Owner atau Kasir.

## Batas fase

Login sesi, katalog layanan, transaksi tunai/QRIS (pencatatan saja, tanpa gateway QRIS), pengurangan stok saat produk terjual, ringkasan Owner, laporan transaksi Owner, daftar absensi, perubahan tarif layanan, profil outlet, shift, absensi karyawan, serta source Membership dan Drop Off terhubung ke PostgreSQL. Jalankan migration yang dibutuhkan sebelum menggunakan Self Service per baris dan Membership pada database existing. Pencatatan pengeluaran, promo, dan integrasi Google Sheets belum memiliki skema atau endpoint. Pada POS Kasir, manajemen stok, koin, laporan shift, histori, dan pengelolaan status pesanan masih menggunakan data prototipe dan belum disimpan ke database. Tidak ada API eksternal palsu.
