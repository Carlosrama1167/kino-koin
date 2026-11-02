# Peta Fitur KINO Laundry POS

Status di bawah diverifikasi dari source React, route PHP, schema SQL, serta agregat database lokal pada 2 November 2026. Database lokal belum menjalankan migration membership terbaru.

| Fitur | UI/source | API/tabel | Status aktual |
|---|---|---|---|
| Login dan role | `src/features/auth/LoginPage.jsx`, `src/app/Root.jsx` | `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`; `users` | Aktif; session dan password hash. |
| Checkout Self Service dan Drop Off | `src/features/cashier/CashierApp.jsx` | `POST /api/transactions`; `transactions`, `transaction_items`, `services` | Self Service dihitung per baris; kombinasi Drop Off divalidasi di UI dan backend. Kering saja Rp12.000 per 7 kg. Migration `20261102_001_self_service_line_weights.sql` dan `20261102_002_membership_and_dropoff_dry.sql` perlu diterapkan pada database existing. |
| Membership | `src/features/owner/components/OwnerMembership.jsx`, `src/features/cashier/components/MembershipPicker.jsx`, `src/features/owner/components/OwnerDashboard.jsx` | `/api/membership/*`, `/api/owner/membership/*`; `membership_types`, `membership_members`, `membership_cards`, `membership_stamps`, `membership_raffle_coupons`, `membership_card_redemptions` | API dan UI tersedia di source, termasuk ringkasan member aktif, kartu penuh, dan kupon pada dashboard; migrasi belum diterapkan ke database lokal. Stempel dan penyerahan kartu memakai transaksi PostgreSQL, idempotensi, dan constraint unik. |
| Dashboard Owner | `src/features/owner/components/OwnerDashboard.jsx` | `/api/owner/dashboard`, `/api/owner/membership/summary`; transaksi, pembayaran, order, produk, koin, shift, absensi, membership | Data aktual; pilihan periode mencakup Kuartal. |
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
