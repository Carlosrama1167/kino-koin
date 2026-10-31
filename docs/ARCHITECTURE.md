# Arsitektur KINO Laundry POS

Dokumen ini mencatat implementasi yang diperiksa pada 31 Oktober 2026. Detail audit revisi Owner dan proposal tahap lanjut ada di [OWNER_REVISION_PLAN.md](./OWNER_REVISION_PLAN.md).

## Stack dan entry point

- Frontend React 18/JSX dengan Vite; entry `src/main.jsx`.
- `src/app/Root.jsx` memulihkan sesi lewat `/api/auth/me`, lalu menampilkan login atau portal berdasarkan role.
- Backend PHP memiliki satu front controller di `api/public/index.php`; `api/bootstrap.php` menginisialisasi PostgreSQL PDO, session, autentikasi dan CSRF.
- Database PostgreSQL; schema sumber ada di `database/schema.sql` dan perubahan checkout pada `database/migrations/20261031_001_integrated_checkout.sql`.
- Tidak ditemukan React Router atau state management global; menu portal menggunakan state React lokal.

## Frontend

```text
src/
  app/Root.jsx
  shared/api.js
  features/
    auth/LoginPage.jsx
    owner/components/
    cashier/CashierApp.jsx
    cashier/components/
    employee/components/AttendancePage.jsx
```

Komponen dan tampilan Owner berada di `src/features/owner/`; navigasi Cashier serta transaksi berada di `src/features/cashier/`; absensi mandiri di `src/features/employee/`. Styling Owner dan motion dipisahkan dalam stylesheet Owner.

## Autentikasi dan otorisasi

Login menggunakan session cookie PHP, verifikasi `password_hash`, `session_regenerate_id`, dan CSRF untuk request mutasi. `require_user()` mengambil ulang pengguna aktif dari database. Role skema: `owner`, `kasir`, `karyawan`. Otorisasi harus tetap ditegakkan API, bukan hanya menu frontend.

## Database dan alur data

Tabel utama: `users`, `outlets`, `shifts`, `shift_schedules`, `employee_attendance`, `services`, `service_prices`, `products`, `transactions`, `transaction_items`, `payments`, `laundry_orders`, `coin_movements`, `inventory_movements`, dan `sync_jobs`.

POS membaca layanan/produk dari API; checkout menghitung harga dari database, memvalidasi shift dan stok, lalu menyimpan transaksi/item/pembayaran serta mutasi terkait dalam transaksi PostgreSQL. Riwayat dan dashboard Owner juga menggunakan endpoint aktual. Tabel `sync_jobs` ada, tetapi belum ditemukan worker atau endpoint sinkronisasi Google Sheets.

## Batas kondisi yang telah diverifikasi

- Endpoint Owner memilih outlet aktif pertama; jangan mengasumsikan dukungan multi-outlet yang terisolasi.
- `shifts.user_id` saat ini merepresentasikan akun login Kasir, belum karyawan yang ditugaskan.
- Tidak ada tabel expense/promo/membership/rekonsiliasi kas fisik atau metadata foto profil di schema saat ini.
- Metadata database lokal pada saat audit: 12 layanan aktif, 0 produk, satu akun Owner aktif, satu akun Kasir aktif, belum ada akun Karyawan aktif; tidak ada absensi atau job sinkronisasi. Database produksi tidak diperiksa.

## Referensi

- [Front controller API](../api/public/index.php)
- [Bootstrap backend](../api/bootstrap.php)
- [Schema PostgreSQL](../database/schema.sql)
- [Root aplikasi](../src/app/Root.jsx)
- [Klien API frontend](../src/shared/api.js)
- [Rencana revisi Owner](./OWNER_REVISION_PLAN.md)
