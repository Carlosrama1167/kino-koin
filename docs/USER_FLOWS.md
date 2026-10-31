# Alur Pengguna KINO Laundry POS

Dokumen ini menggambarkan alur yang tersedia pada kode saat audit 31 Oktober 2026. Alur pengeluaran, CRUD karyawan, promo, Sheets, serta foto profil adalah proposal dan dijelaskan di [OWNER_REVISION_PLAN.md](./OWNER_REVISION_PLAN.md), bukan fitur yang sudah aktif.

## Login dan pemilihan role

1. `src/app/Root.jsx` meminta `/api/auth/me`.
2. Bila tidak ada session aktif, tampilkan `src/features/auth/LoginPage.jsx`.
3. Login memakai `/api/auth/login`; server memverifikasi user aktif dan password hash.
4. `owner` membuka `OwnerPortal`, `kasir` membuka `CashierApp`, `karyawan` membuka `AttendancePage`.
5. Semua endpoint harus tetap melakukan otorisasi server-side.

## Owner: dashboard dan laporan

1. Owner memilih halaman melalui navigasi state di `OwnerPortal`.
2. Dashboard meminta `/api/owner/dashboard` untuk transaksi lunas, pembayaran, order, layanan, stok/koin, kehadiran, dan sesi shift terbaru.
3. Owner memilih periode; filter Kuartal masih ada pada Dashboard dan Laporan Keuangan saat audit.
4. Laporan Keuangan meminta `/api/owner/finance` untuk daftar transaksi dan ringkasan pembayaran.
5. UI menyatakan data pengeluaran belum tersedia; dashboard/laporan tidak menghitung pengeluaran sebagai penerimaan atau laba.

## Owner: karyawan, tarif, produk, pengaturan

- Halaman Karyawan & Shift meminta `GET /api/attendance` dan dapat memfilter tanggal/nama/shift. Halaman saat ini baca-saja; check-in tidak otomatis mengisi `employee_attendance.shift_id`.
- Halaman Harga & Promo membaca katalog `services` dan dapat memperbarui harga normal/malam. Area Promo hanya status belum tersedia.
- Dashboard Owner membaca produk/stok; tidak ada alur CRUD produk Owner.
- Pengaturan Bisnis membaca/menyimpan nama, alamat, dan nomor telepon outlet.
- Integrasi Google Sheets hanya menampilkan belum terhubung; tidak ada sinkronisasi yang berjalan.

## Kasir: shift dan transaksi

1. Login sebagai akun role Kasir.
2. Jika tidak ada sesi terbuka, pilih jenis shift dan panggil `/api/shifts/open`.
3. Pilih layanan/produk yang dibaca dari `/api/services` dan `/api/products`.
4. Checkout mengirim `/api/transactions`; server menghitung harga, memeriksa shift/stok, dan menyimpan record terkait secara atomik/idempoten.
5. Pembayaran/pelunasan tercatat pada `payments` dan shift penerima.
6. Sesi ditutup manual melalui `/api/shifts/close`; rekap belum memiliki input hitung fisik kas/koin.
7. Tidak ada alur Pengeluaran Kasir yang tersimpan di database pada kondisi saat audit.

Satu akun Kasir aktif ditemukan pada database lokal. Namun `shifts.user_id` adalah user login; sistem belum mencatat karyawan yang benar-benar bertugas terpisah dari akun bersama.

## Karyawan: absensi

1. Pengguna role Karyawan login melalui form bersama.
2. `AttendancePage` meminta `/api/attendance/me`.
3. Pengguna mencatat masuk/pulang melalui `/api/attendance/check-in` dan `/api/attendance/check-out`.
4. Server menyimpan ke `employee_attendance`; belum ada API Owner untuk membuat atau mengubah akun Karyawan.

## Alur yang direncanakan, belum aktif

Pengeluaran, penautan expense dengan penerimaan stok, rekonsiliasi kas/koin, penugasan karyawan ke shift, CRUD produk/promo, sinkronisasi Sheets, dan upload foto profil belum boleh dianggap tersedia sebelum backend, database, hak akses, serta pengujiannya diimplementasikan.

## Referensi

- [Root dan role routing](../src/app/Root.jsx)
- [Portal Owner](../src/features/owner/components/OwnerPortal.jsx)
- [Dashboard Owner](../src/features/owner/components/OwnerDashboard.jsx)
- [Kasir](../src/features/cashier/CashierApp.jsx)
- [Absensi Karyawan](../src/features/employee/components/AttendancePage.jsx)
- [Routes API](../api/public/index.php)
- [Rencana revisi Owner](./OWNER_REVISION_PLAN.md)
