# Peta Fitur KINO Laundry POS

Status di bawah diverifikasi dari source React, route PHP, schema SQL, serta agregat database lokal pada 31 Oktober 2026. Detail fitur yang belum ada dan rencana integrasinya ada di [OWNER_REVISION_PLAN.md](./OWNER_REVISION_PLAN.md).

| Fitur | UI/source | API/tabel | Status aktual |
|---|---|---|---|
| Login dan role | `src/features/auth/LoginPage.jsx`, `src/app/Root.jsx` | `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`; `users` | Aktif; session dan password hash. |
| Dashboard Owner | `src/features/owner/components/OwnerDashboard.jsx` | `/api/owner/dashboard`; transaksi, pembayaran, order, produk, koin, shift, absensi | Data aktual; pilihan periode mencakup Kuartal. |
| Laporan keuangan | `src/features/owner/components/OwnerModule.jsx` → `FinanceReport` | `/api/owner/finance`; `transactions`, `payments`, `customers` | Transaksi/pembayaran aktual; belum ada expense. |
| Absensi Owner | `src/features/owner/components/AttendanceAdmin.jsx` | `GET /api/attendance`; `users`, `employee_attendance`, `shifts` | Baca/filter saja; bukan CRUD karyawan. |
| Akun karyawan | Belum ada UI Owner | Skrip CLI `api/scripts/create_user.php`; `users` | UI CRUD/reset password belum tersedia; akun Karyawan aktif tidak ada pada DB lokal saat audit. |
| Tarif normal/malam | `src/features/owner/components/OwnerModule.jsx` → `PriceManagement` | `/api/owner/services`, `/api/owner/services/price`; `services`, `service_prices` | Baca dan ubah harga aktual. |
| Produk/stok Owner | Ringkasan pada `src/features/owner/components/OwnerDashboard.jsx` | `GET /api/products`; `products`, `inventory_movements` | Kasir membaca katalog yang sama; CRUD produk Owner belum ada. Database lokal saat audit memiliki 0 produk. |
| Promo | Placeholder pada `OwnerModule.jsx` | Tidak ada route/tabel promo | Belum tersedia. |
| Pengeluaran | Tidak ada halaman Pengeluaran Owner/Kasir | Tidak ada tabel/route expense | Belum tersedia; tidak boleh disimulasikan sebagai data aktual. |
| Shift | `src/features/cashier/CashierApp.jsx`, `src/features/cashier/components/ShiftReports.jsx` | `/api/shifts/open`, `/api/shifts/close`, `/api/shifts/reports`; `shifts`, `shift_schedules` | Sesi dibuka/ditutup manual. Identitas petugas fisik dan tanggal operasional belum disimpan. |
| Google Sheets | `OwnerModule.jsx` → `IntegrationStatus` | `sync_jobs` ada; belum ada worker/endpoint integrasi | Status “belum terhubung”; tidak ada sinkronisasi aktif. |
| Foto profil | Belum ada UI | Tidak ada kolom profil foto atau route upload | Belum tersedia. |
| Outlet Owner | `OwnerModule.jsx` → `BusinessSettings` | `/api/owner/outlet`; `outlets` | Baca/ubah info outlet aktif pertama. |

Data statis di folder `src/features/cashier/data/` tidak menjadi sumber data untuk fitur Owner yang dirujuk tabel ini.

## Referensi

- [Dashboard Owner](../src/features/owner/components/OwnerDashboard.jsx)
- [Modul Owner](../src/features/owner/components/OwnerModule.jsx)
- [Absensi Owner](../src/features/owner/components/AttendanceAdmin.jsx)
- [Schema](../database/schema.sql)
- [Routes API](../api/public/index.php)
- [Rencana revisi Owner](./OWNER_REVISION_PLAN.md)
