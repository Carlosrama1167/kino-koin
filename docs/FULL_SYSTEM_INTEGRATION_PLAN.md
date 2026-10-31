# Rencana Audit Integrasi Sistem KINO Laundry POS

> **Pembaruan implementasi:** Dokumen audit awal di bawah merekam kondisi sebelum pekerjaan integrasi. Implementasi terbaru dan batas yang masih menunggu konfirmasi bisnis dicatat pada bagian **Status implementasi terkini**; status audit awal bukan gambaran kode saat ini.

## Status implementasi terkini

Validasi terakhir: `npm.cmd run build`, `php -l api/public/index.php`, dan `php -l api/bootstrap.php` berhasil. Migrasi aditif `20261031_001_integrated_checkout.sql` telah diterapkan ulang ke database pengembangan lokal yang diverifikasi `APP_ENV=local`, host `127.0.0.1`, database `KinoKoinLoundry`. Query Owner dan skema checkout diuji; transaksi uji ditutup dengan rollback. Tidak ada migrasi ke produksi, commit, push, atau dependency baru.

**Perbaikan katalog Transaksi Baru:** investigasi menu layanan kosong menemukan database lokal memiliki 0 layanan aktif. Seed katalog resmi `database/seed.sql` telah dijalankan secara idempoten pada database lokal dan kini menyediakan 12 layanan di empat kategori. Seed ini tidak berisi data produk, sehingga kategori Produk & Minuman tetap kosong sampai produk aktual dimasukkan melalui inventaris.

### Yang sudah diimplementasikan

- **P0:** Checkout menyimpan transaksi dan item sebagai snapshot harga/subtotal, pelanggan, berat, catatan, ongkir, diskon tervalidasi, status pembayaran, dan nomor transaksi dari sequence. Idempotency key mencegah duplikasi saat retry, cart dipertahankan ketika request gagal, dan operasi checkout menggunakan transaksi PostgreSQL.
- Pembayaran tunai dan pelunasan tertunda dicatat pada shift penerima. QRIS dapat ditandai lunas hanya melalui konfirmasi manual kasir dengan petugas/waktu audit; tidak diklaim terverifikasi oleh provider. Pembayaran parsial/split belum didukung.
- Riwayat transaksi dan pesanan membaca API aktual. Status pengerjaan pesanan terpisah dari status pembayaran dan perubahan status memiliki riwayat.
- Penjualan produk mengurangi stok dan mencatat mutasi secara atomik. Penggunaan koin otomatis satu per mesin, dua koin reguler per pasangan Cuci + Kering, dan satu koin khusus per pengering Extra Dry; mutasi terikat transaksi dan bersifat idempoten. Koreksi stok/koin memerlukan alasan.
- Jumlah mesin cuci/pengering adalah `ceil(berat/7)`; harga Self Service per siklus dikalikan jumlah mesin. Rumus dan biaya/koin ditampilkan Kasir dan disimpan sebagai snapshot transaksi.
- Sesi shift dibuka/ditutup manual dari Kasir. Empat jadwal (pagi, siang, sore, malam) tersimpan pada `shift_schedules`; ringkasan penutupan menampilkan transaksi, pembayaran, tagihan belum lunas, dan mutasi koin. Tidak ada penutupan otomatis.
- Dashboard Owner mengambil data aktual transaksi/pembayaran/pesanan serta menampilkan stok, saldo/pengeluaran koin, dan sesi shift terbaru. Endpoint Owner dibatasi ke satu outlet aktif sesuai keputusan pengguna.
- Dashboard Kasir mengambil ringkasan sesi dan aktivitas terbaru dari API; angka hitungan pesanan statis pada navigasi telah dihapus.

### Belum selesai / tidak diasumsikan

- Pembayaran parsial/split dan pembatalan/refund setelah pembayaran belum didukung karena batas skema saat ini satu payment per transaksi.
- Balasan terakhir diartikan bahwa “30” adalah saldo fisik koin Extra Dry. Saldo database tidak ditimpa karena belum ada persetujuan eksplisit untuk memasukkan stok awal; pengisian saldo perlu dilakukan melalui mutasi koin yang diaudit. Durasi Extra Dry tidak diubah.
- **P2 belum lengkap:** peringatan akhir shift non-berulang, serah terima, tanggal operasional eksplisit, dan rekonsiliasi fisik kas/koin belum tersedia. Laporan memakai tanggal mulai sesi dalam timezone Asia/Jakarta; shift tidak ditutup otomatis.
- Satu transaksi tetap mewakili satu kelompok/jenis layanan utama; beberapa kelompok cucian berbeda belum didukung.
- Uji tulis database menggunakan transaksi lokal yang di-rollback berhasil, tetapi checkout penuh tidak dapat dijalankan pada data lokal saat ini karena katalog layanan Self Service belum tersedia dan saldo kedua jenis koin bernilai nol. Smoke test browser terautentikasi, concurrency, dan operasional data perlu dilakukan setelah data uji yang sesuai disiapkan.

File implementasi utama: `api/public/index.php`, `database/schema.sql`, `database/migrations/20261031_001_integrated_checkout.sql`, `src/features/cashier/CashierApp.jsx`, komponen operasional Kasir di `src/features/cashier/components/`, dan `src/features/owner/components/OwnerDashboard.jsx`.

## Ruang lingkup dan batas verifikasi

Bagian audit awal di bawah adalah snapshot statis sebelum implementasi. Implementasi memakai database pengembangan lokal saja; database produksi tidak diakses, dan transaksi uji dibatalkan dengan rollback.

Sumber utama:

- [Peta arsitektur dan alur](./architecture-and-flows.md)
- [Front controller API](../api/public/index.php)
- [Bootstrap API](../api/bootstrap.php)
- [Skema PostgreSQL](../database/schema.sql)
- [Seed katalog](../database/seed.sql)
- [Root frontend](../src/app/Root.jsx)
- [API client frontend](../src/shared/api.js)

## 1. Ringkasan kondisi sistem aktual

- Frontend menggunakan React 18 dan Vite. Root aplikasi memilih halaman login, Kasir, Owner, atau absensi berdasarkan role pengguna. Navigasi halaman di dalam portal dikelola melalui state lokal; tidak ditemukan router atau store global.
- Backend menggunakan satu front controller PHP di `api/public/index.php`, PDO untuk akses PostgreSQL, session, dan pemeriksaan CSRF melalui helper di `api/bootstrap.php`.
- Skema sudah mencakup transaksi, item transaksi, pembayaran, pesanan laundry, pengiriman, produk/stok, mutasi inventaris, shift, tipe/mutasi koin, pelanggan, absensi, dan status job sinkronisasi.
- Integrasi transaksi tidak sepenuhnya belum ada: tombol konfirmasi POS memanggil `POST /api/transactions`, dan backend menyimpan transaksi, item, pembayaran, pengurangan stok produk, serta mutasi inventaris dalam satu transaksi database.
- Batas penting: checkout tersebut selalu membuat transaksi `lunas`, QRIS langsung dicatat sebagai diterima tanpa verifikasi eksternal, dan input pelanggan/berat/catatan/ongkir/diskon tidak masuk ke payload. Untuk Drop Off, backend membuat pesanan tetapi tanpa detail pelanggan atau berat.
- Owner Dashboard dan Laporan Keuangan mengambil data aktual dari API, tetapi cakupan query belum dibatasi ke outlet milik Owner. Sebagian halaman Kasir yang tampak operasional masih menggunakan mock data.

## 2. Fitur yang sudah berfungsi atau terhubung

| Fitur | Kondisi yang ditemukan | Sumber |
|---|---|---|
| Login, session, role | Frontend memuat user dari `/api/auth/me`; login/logout dan CSRF menggunakan API. Role `owner`, `kasir`, `karyawan` ada pada skema. | `src/app/Root.jsx`, `src/shared/api.js`, `api/public/index.php`, `api/bootstrap.php`, `database/schema.sql` |
| Absensi karyawan | Check-in, check-out, daftar absensi, dan ringkasan Owner memiliki endpoint. | `api/public/index.php`, `src/features/employee/components/AttendancePage.jsx`, `src/features/owner/components/AttendanceAdmin.jsx` |
| Katalog layanan | Kasir dapat membaca layanan backend; harga malam tersedia pada tabel `service_prices`. Owner dapat membaca dan mengubah tarif. | `api/public/index.php`, `src/features/cashier/CashierApp.jsx`, `src/features/owner/components/OwnerModule.jsx`, `database/seed.sql` |
| Daftar produk untuk POS | `GET /api/products` membaca produk aktif, harga, stok, dan unit. | `api/public/index.php`, `src/features/cashier/CashierApp.jsx` |
| Pembuatan transaksi POS | `POST /api/transactions` memvalidasi item, menghitung harga dari database, memvalidasi uang tunai, mengunci shift dan stok terkait, lalu menyimpan transaksi dalam database transaction. | `api/public/index.php`, `src/features/cashier/CashierApp.jsx` |
| Item layanan dan produk | Item disimpan dengan deskripsi, kuantitas, harga unit, dan subtotal. Produk yang dijual mengurangi stok dan mencatat `inventory_movements`. | `api/public/index.php`, `database/schema.sql` |
| Pembayaran checkout | Satu pembayaran dengan metode tunai atau QRIS dibuat dan ditautkan ke shift penerima. Tidak ada verifikasi QRIS terintegrasi. | `api/public/index.php`, `database/schema.sql` |
| Shift aktual | Shift dapat dibuka dan ditutup manual melalui API, menyimpan `started_at`/`ended_at`, dan hanya mengizinkan satu shift terbuka per pengguna. Penutupan mengembalikan ringkasan pembayaran. | `api/public/index.php`, `database/schema.sql` |
| Dashboard Owner | Metrik, grafik, pembayaran, pesanan, absensi, layanan teratas membaca query PostgreSQL melalui API. | `src/features/owner/components/OwnerDashboard.jsx`, `api/public/index.php` |
| Laporan keuangan Owner | Filter periode, pencarian transaksi/pelanggan, metode dan status pembayaran menggunakan endpoint aktual; ekspor CSV dibuat dari hasil API. | `src/features/owner/components/OwnerModule.jsx`, `api/public/index.php` |
| Harga dan informasi outlet Owner | Tarif layanan dan profil outlet dapat dibaca/diubah lewat API. | `src/features/owner/components/OwnerModule.jsx`, `api/public/index.php` |

## 3. Fitur mock, lokal, API yang belum ada, dan gap skema

### Mock/state lokal

- Riwayat transaksi dan pratinjau nota memakai `mockTransactions`; tidak mengambil daftar transaksi backend. Data yang berhasil checkout tidak otomatis muncul pada halaman ini.
- Pesanan laundry memakai `mockOrders`; perubahan status hanya mengubah state React. Tidak ada endpoint daftar/detail/perubahan status pesanan yang ditemukan.
- Produk & Stok memakai `mockInventory`; penambahan/penyesuaian stok serta riwayat hanya mengubah state halaman. UI tersebut tidak membaca `GET /api/products`.
- Manajemen Koin dan Laporan Shift menggunakan data contoh. UI koin hanya memodifikasi mock; UI laporan menampilkan data statis meskipun tabel/API terkait sebagian sudah ada.
- Dashboard Kasir mengambil ringkasan shift dari API melalui state awal, tetapi aktivitas terbaru/komponen ringkasan visual lain memakai data statis.
- Kolom nama/nomor pelanggan, berat, dan jumlah mesin di formulir Drop Off merupakan input lokal dan tidak dihubungkan ke keranjang/payload checkout.
- Tombol “Simpan pesanan” pada keranjang hanya menampilkan toast lokal; tidak membuat order draft di backend.
- Pengaturan Kasir, preferensi POS, printer, notifikasi dan toggle sebagian besar state lokal; halaman Settings Owner yang terpisah memang menyimpan profil outlet.
- Data produk untuk UI perlu dibandingkan dengan data katalog database saat runtime. Seed yang diperiksa mengisi layanan dan dua tarif malam; tidak mengisi produk. Produk aktual yang tersedia bergantung pada data yang sudah dimasukkan di database.

### Endpoint belum ditemukan

Tidak ditemukan endpoint untuk daftar/detail/riwayat transaksi Kasir, daftar/detail/status pesanan, mutasi atau rekonsiliasi stok, tipe/mutasi/rekonsiliasi koin, laporan shift, transaksi belum lunas atau pencatatan pembayaran lanjutan, draft pesanan, jadwal shift, maupun riwayat perubahan status.

### Kesenjangan skema atau aturan yang belum tercakup

- `transactions` belum memiliki snapshot diskon, catatan transaksi, maupun snapshot aturan harga/unit/parameter layanan yang lebih rinci. Kolom ongkir ada, namun checkout tidak mengisinya.
- `customers` dan `laundry_orders.customer_id` ada, tetapi checkout selalu menyimpan `customer_id` transaksi sebagai `NULL`; input pelanggan tidak disimpan.
- `laundry_orders.weight` dan `notes` ada, tetapi endpoint checkout hanya membuat order Drop Off dengan `transaction_id`, `service_type`, dan status default.
- `deliveries` mendukung jenis pengiriman dan ongkir, tetapi tidak dipakai endpoint checkout.
- `transaction_items` menyimpan kuantitas generik; belum ada berat, jumlah mesin/siklus, kelompok cucian, atau rincian layanan eksklusif per kelompok.
- `coin_types` dan `coin_movements` tersedia, tetapi endpoint transaksi tidak mencatat koin; tabel mutasi tidak memiliki kolom alasan/petugas dan belum ada rekonsiliasi.
- `inventory_movements` tersedia dan dipakai untuk penjualan produk, tetapi penyesuaian stok belum punya endpoint; `reference_id` bukan FK dan tidak merekam alasan/petugas.
- `shifts` tidak menyimpan tanggal operasional, jadwal terencana, peringatan, serah terima, saldo kas fisik, atau hasil rekonsiliasi koin.
- Belum ada tabel riwayat perubahan status laundry/pembayaran yang dapat diaudit.
- `payments.transaction_id` unik sehingga hanya mendukung satu record pembayaran per transaksi; kebutuhan pembayaran sebagian/lebih dari satu metode perlu dikonfirmasi sebelum perubahan.
- `sync_jobs` tersedia, tetapi tidak ada endpoint/UI yang menghubungkan integrasi Google Sheets. UI Owner dengan benar menyebut integrasi belum dikonfigurasi.

## 4. Pemetaan komponen React ke API

| Komponen/halaman | API sekarang | Gap utama |
|---|---|---|
| `src/app/Root.jsx`, `src/features/auth/LoginPage.jsx` | `/api/auth/me`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/csrf` | Pastikan navigasi role dan akses tiap route tetap teruji saat integrasi diperluas. |
| `src/features/employee/components/AttendancePage.jsx` | `/api/attendance/me`, `/api/attendance/check-in`, `/api/attendance/check-out` | Hubungan shift kerja dengan absensi perlu aturan operasional yang dikonfirmasi. |
| `src/features/owner/components/AttendanceAdmin.jsx` | `/api/attendance` | Bukan sistem jadwal/sesi shift kasir; jangan dianggap menggantikan jadwal shift. |
| `src/features/cashier/CashierApp.jsx` | `/api/services`, `/api/products`, `/api/cashier/dashboard`, `/api/shifts/open`, `/api/transactions` | Tidak mengirim pelanggan, berat, jumlah mesin, kelompok layanan, catatan, ongkir, diskon, atau koin; tidak mencegah double submit di sisi UI; status pembayaran QRIS dianggap sukses. |
| `src/features/cashier/components/CashierDashboard.jsx` | Tidak memiliki request mandiri yang ditemukan; dashboard shift awal tersedia lewat `CashierApp` | Aktivitas/recent summary bukan sumber API; close shift tidak terhubung dari halaman dashboard yang diperiksa. |
| `src/features/cashier/components/TransactionHistory.jsx` | Tidak ada | Hubungkan daftar/detail/filters/pagination dan cetak/ekspor ke endpoint transaksi aktual. |
| `src/features/cashier/components/OrderManagement.jsx` | Tidak ada | Hubungkan pesanan aktual, status laundry, detail, dan riwayat perubahan status. |
| `src/features/cashier/components/InventoryManagement.jsx` | Tidak ada | Gunakan katalog stok backend dan endpoint mutasi/riwayat, bukan state mock. |
| `src/features/cashier/components/CoinManagement.jsx` | Tidak ada | Gunakan data tipe dan mutasi koin aktual; cegah pencatatan ganda. |
| `src/features/cashier/components/ShiftReports.jsx` | Tidak ada | Gunakan API rekap berdasarkan sesi/tanggal operasional, pembayaran, order, dan rekonsiliasi. |
| `src/features/cashier/components/SettingsPage.jsx` | Tidak ada | Preferensi browser boleh tetap lokal; profil outlet yang tersimpan perlu diselaraskan atau dibedakan tegas dari Settings Owner. |
| `src/features/owner/components/OwnerDashboard.jsx` | `/api/owner/dashboard` | API memakai data aktual, tetapi banyak query belum dibatasi outlet; pesanan tidak mengikuti rentang tanggal dashboard. |
| `src/features/owner/components/OwnerModule.jsx` | `/api/owner/finance`, `/api/owner/services`, `/api/owner/services/price`, `/api/owner/outlet` | Belum ada halaman Owner untuk stok, koin, atau laporan shift. Filter finance berdasarkan pembayaran perlu dipastikan semantik tanggalnya. |

## 5. Pemetaan endpoint PHP ke tabel PostgreSQL

| Endpoint | Tabel/kolom utama | Status |
|---|---|---|
| Auth: `/api/auth/csrf`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` | `users`; session/CSRF dikelola bootstrap | Tersedia; kata sandi/session perlu tetap diverifikasi pada konfigurasi runtime, tidak diuji terhadap DB di audit ini. |
| `GET /api/services` | `services`, `service_prices` | Tersedia; harga malam dipilih dengan jendela waktu yang ditetapkan backend. |
| `GET /api/products` | `products` | Tersedia untuk Kasir. |
| `/api/attendance*` | `employee_attendance`, `users`, `outlets`, `shifts` | Tersedia untuk absensi, bukan jadwal shift. |
| `GET /api/owner/dashboard` | `transactions`, `payments`, `laundry_orders`, `employee_attendance`, `transaction_items` | Query data aktual; beberapa query tidak menerapkan outlet scope dan orders global. |
| `GET /api/owner/finance` | `transactions`, `payments`, `customers` | Tersedia; pembayaran saat ini satu-per-transaksi. |
| `GET/PUT /api/owner/services*` | `services`, `service_prices` | Tersedia; update tarif malam menetapkan rentang 23:00–06:00. |
| `GET/PUT /api/owner/outlet` | `outlets` | Memilih outlet aktif pertama secara global, bukan outlet dari konteks Owner. |
| `GET /api/cashier/dashboard` | `shifts`, `transactions` | Ringkasan sesi shift terbuka. |
| `POST /api/shifts/open`, `POST /api/shifts/close` | `shifts`, `payments` | Buka/tutup sesi aktual; laporan close hanya mengembalikan tunai, QRIS dan jumlah pembayaran. |
| `POST /api/transactions` | `shifts`, `services`, `service_prices`, `products`, `transactions`, `transaction_items`, `payments`, `inventory_movements`, `laundry_orders` | Penyimpanan dalam satu DB transaction; belum menyimpan semua input UI/kebutuhan bisnis. |
| Belum ada route untuk mutasi/rekonsiliasi koin | `coin_types`, `coin_movements` | Tabel ada, belum diintegrasikan. |
| Belum ada route untuk penyesuaian stok | `products`, `inventory_movements` | Pencatatan stok keluar penjualan tersedia dari checkout; penyesuaian manual belum ada. |
| Belum ada route untuk delivery/status history | `deliveries`, `laundry_orders` | Tabel tersedia, belum terhubung pada flow pesanan yang diperiksa. |

## 6. Bug dan integrasi yang belum lengkap

1. **Pembayaran dianggap lunas tanpa bukti.** `POST /api/transactions` menyimpan `payment_status='lunas'` untuk tunai dan QRIS, lalu selalu membuat pembayaran sejumlah total. QRIS tidak memiliki integrasi verifikasi. Status hanya boleh menjadi lunas setelah pembayaran benar-benar diterima/dikonfirmasi sesuai kebijakan.
2. **Form Drop Off tidak terikat ke transaksi.** Formulir nama, nomor HP, berat dan jumlah mesin tidak dikontrol/diikutkan ke payload; backend menyimpan pelanggan `NULL` dan berat order `NULL`.
3. **Input transaksi yang terlihat belum persist.** Catatan, ongkir, diskon, dan beberapa kelompok cucian tidak diterima endpoint. Tombol “Simpan pesanan” tidak membuat record.
4. **Tipe transaksi produk dari frontend tidak dipakai backend.** Frontend dapat mengirim `transaction_type: product`, tetapi backend hanya memilih `drop_off` atau default `self_service`. Skema sendiri mengizinkan `product`.
5. **Tidak ada pencegahan idempotensi.** Nomor transaksi dibuat dari waktu detik dan angka acak, dengan unique constraint sebagai perlindungan terakhir. Retry/double-click bisa menghasilkan dua transaksi jika request pertama sudah commit; benturan nomor akan gagal, tidak di-retry secara terarah.
6. **Tidak ada status unpaid yang dapat dipilih checkout.** Payment method QRIS langsung menyelesaikan transaksi; UI tidak menawarkan flow menunggu konfirmasi atau pencatatan pembayaran sesudah transaksi.
7. **Halaman Kasir tidak menunjukkan record yang baru disimpan.** Riwayat, pesanan, dashboard ringkas, laporan shift, stok, dan koin masih memakai mock/state lokal.
8. **Close shift tersedia di backend tetapi tidak terhubung pada layar Kasir yang diperiksa.** Tidak ada laporan akhir rekonsiliasi kas/koin fisik.
9. **Jadwal shift tidak ada.** Sesi manual menyimpan waktu aktual, sesuai prinsip tidak menutup otomatis. Namun tipe dan definisi jadwal yang diminta belum lengkap: skema/API/UI hanya menyediakan `pagi`, `siang`, `malam`; tidak ada `sore` atau jadwal jam 06–12, 13–18, 19–00, 01–06 yang tersimpan.
10. **Tanggal operasional belum tersimpan.** Rekap berdasarkan shift yang melewati tengah malam tidak bisa ditentukan secara eksplisit dari tanggal kalender saja.
11. **Harga malam dan shift adalah konsep terpisah saat ini.** Backend menentukan tarif malam pukul 23:00 sampai sebelum 06:00 berdasarkan jam Asia/Jakarta, terpisah dari `shift_type`. Akan tetapi backend meng-hardcode batas ini alih-alih mengevaluasi `service_prices.start_time/end_time`; jangan mengubahnya menjadi shift malam.
12. **Satuan harga berbeda antar layanan.** Seed menetapkan Self Service per `siklus`, Drop Off Cuci+Kering per `muatan`, sebagian Drop Off/CKS/Setrika per `kg`. Backend mengalikan harga dengan kuantitas generik; UI belum memberi input berat yang terhubung sehingga tarif per kg belum terhitung dari berat aktual.
13. **Pemetaan kapasitas belum terstruktur.** Katalog UI menyebut kapasitas maksimal mesin cuci 7 kg serta keterangan kering 7 kg; belum ditemukan kapasitas pengering terpisah di konfigurasi/data bisnis. Jangan menyimpulkan kapasitas pengering sama.
14. **Jumlah mesin dan aturan koin belum diterapkan ke checkout.** Katalog UI menyebut waktu layanan dan informasi koin secara deskriptif, tetapi belum ada perhitungan koin/mesin di backend. Formula `ceil(berat/7)` hanya berlaku bila layanan dan aturan kapasitasnya telah dikonfirmasi.
15. **Cakupan outlet Owner belum konsisten.** Endpoint Owner dashboard/finance memakai query tanpa filter `outlet_id`; order dan sebagian data attendance juga agregat global. Owner outlet memilih outlet aktif pertama. Jika ada lebih dari satu outlet atau akses lintas outlet tidak disengaja, data antar-outlet dapat tercampur.
16. **Harga malam dinamis perlu konsistensi.** Harga saat checkout dihitung ulang di server (baik), tetapi keterangan/rentang waktu harga disimpan terpisah dan lookup backend memakai jam tetap. UI yang memakai fallback katalog lokal saat API gagal dapat menampilkan nominal yang tidak dapat dipakai untuk transaksi jika `service_id` backend tidak tersedia.
17. **Semantik laporan Owner belum seragam.** Ringkasan pendapatan/chart berdasar tanggal transaksi `created_at`; pembayaran diterima dihitung dari `payments.paid_at`. Ini masuk akal untuk dua metrik berbeda, namun harus dijelaskan dan dipastikan sesuai definisi laporan. Query transaksi terbaru dan order tertentu tidak menerapkan filter outlet/status yang sama dengan KPI.
18. **Riwayat audit kurang lengkap.** Belum ada log perubahan status laundry, pembayaran, koreksi stok/koin, alasan koreksi, atau identitas petugas untuk semua mutasi.

## 7. Usulan perubahan database minimal

Jangan membuat tabel duplikat. Tahap implementasi perlu memeriksa kondisi skema database aktual terlebih dahulu dan menggunakan migrasi aditif yang dapat di-rollback.

1. **Shift dan tanggal operasional:** pertimbangkan tabel definisi jadwal (jenis, jam mulai/selesai, zona waktu, aktif) terpisah dari `shifts` sebagai sesi aktual. Tambahkan `operational_date` ke sesi shift. Perlu menyepakati representasi `sore`/empat jenis karena skema saat ini hanya mengizinkan tiga jenis. Simpan peringatan/notifikasi terakhir hanya bila riwayatnya memang dibutuhkan; cegah duplikasi per sesi melalui unique key/field idempotensi.
2. **Transaksi/pembayaran:** perluas transaksi dengan snapshot pelanggan/parameter order yang diperlukan, diskon beserta alasan/otorisasi bila ada, catatan, dan data berat/layanan jika tidak bisa direpresentasikan memadai oleh tabel order/item. `delivery_fee` sudah tersedia dan dapat dipakai tanpa kolom duplikat. Pertahankan snapshot `unit_price`/`subtotal` item yang ada. Tentukan apakah payments tetap satu record penuh atau membutuhkan banyak pembayaran/partial; jika butuh partial, ganti unique constraint secara terencana dan hitung `payment_status` konsisten.
3. **Kelompok cucian:** bila satu transaksi harus memuat beberapa kelompok dengan layanan eksklusif, tambahkan relasi grup layanan/order yang mengikat berat, jenis layanan, mesin/siklus, dan detailnya. Jangan menaruh beberapa layanan yang saling bertabrakan di item datar tanpa identitas kelompok.
4. **Pelanggan dan pesanan:** gunakan `customers` dan `laundry_orders` yang sudah ada. Tambahkan hanya atribut yang disetujui (mis. snapshot nama/telepon untuk histori, atau estimator) bila aturan retensi/perubahan pelanggan memerlukannya. Gunakan `deliveries` yang sudah ada untuk data pengiriman.
5. **Status pesanan:** gunakan `laundry_orders.status` yang ada; tambah tabel riwayat status minimal (order, status lama/baru, waktu, aktor, catatan) agar perubahan dapat diaudit.
6. **Koin:** gunakan `coin_types` dan `coin_movements`; tambahkan kolom aktor/alasan dan constraint/referensi idempotensi yang disepakati. Simpan hasil rekonsiliasi shift dan hitung fisik dengan relasi ke sesi shift; saldo sistem sebaiknya dapat direkonstruksi dari saldo awal dan ledger tanpa menghapus mutasi.
7. **Stok:** pertahankan `products`, `inventory_movements`, dan pemakaian `reference_id` yang ada; tambahkan alasan/petugas dan referensi transaksi yang terjamin integritasnya (kolom FK khusus atau desain referensi yang konsisten). Perubahan fisik dan transaksi penjualan harus membukukan mutasi atomik.
8. **Indeks/cakupan:** evaluasi indeks gabungan outlet/tanggal, shift/status, dan filter pesanan setelah query API disepakati. Tidak ada migrasi yang dijalankan dalam audit ini.

## 8. Usulan endpoint API

Gunakan pola JSON, auth role, CSRF untuk mutasi, validasi server, dan transaksi database yang sudah dipakai. Nama berikut rekomendasi, bukan endpoint yang saat ini tersedia.

| Prioritas | Endpoint yang diusulkan | Kegunaan |
|---|---|---|
| P0 | `POST /api/transactions` (evolusi endpoint saat ini) | Buat transaksi dengan idempotency key, pelanggan, grup/item tervalidasi, snapshot harga, catatan, ongkir/diskon yang tervalidasi, dan status pembayaran yang benar. Respon memuat nomor, id/detail, status, dan hasil penyimpanan. |
| P0 | `GET /api/transactions`, `GET /api/transactions/{id}` | Riwayat dan detail transaksi aktual, filter tanggal/shift/status/metode/nomor, paging. Cakupan role dan outlet wajib. |
| P0 | `POST /api/transactions/{id}/payments` (bila mendukung pelunasan) | Mencatat pembayaran aktual; QRIS tidak menjadi lunas sebelum bukti/verifikasi atau konfirmasi manual sesuai kebijakan. |
| P1 | Evolusi payload transaksi untuk grup layanan | Simpan beberapa grup cucian; validasi layanan eksklusif dalam satu grup, berat positif, jumlah mesin dan kuantitas berdasarkan aturan bisnis yang telah dikonfirmasi. |
| P1 | `GET /api/products`, `GET /api/inventory/movements`, `POST /api/inventory/movements` | Daftar stok aktual, histori, dan stok masuk/koreksi dengan alasan/aktor; transaksi penjualan tetap mengurangi stok secara atomik. |
| P1 | `GET /api/coins`, `GET /api/coins/movements`, `POST /api/coins/movements` | Saldo/ledger aktual dan koreksi beralasan; pengeluaran terkait transaksi harus idempoten. |
| P2 | `GET /api/shifts/current`, `POST /api/shifts/open`, `POST /api/shifts/close` (evolusi) | Menampilkan sesi aktual, validasi buka/tutup manual, peringatan akhir jadwal satu kali, dan rekap/rekonsiliasi akhir. |
| P2 | `GET /api/shifts/reports`, `GET /api/shifts/{id}/report` | Ringkasan transaksi, pembayaran menurut shift penerima, unpaid, stok/koin, waktu, petugas dan selisih kas/koin. |
| P2 | `GET /api/orders`, `GET /api/orders/{id}`, `PATCH /api/orders/{id}/status` | Daftar/filter/detail pesanan dan perubahan status laundry dengan riwayat audit. Status pembayaran tetap terpisah. |
| P3 | Evolusi `/api/owner/dashboard`, `/api/owner/finance` | Terapkan scope outlet eksplisit; agregasi pembayaran, transaksi, pesanan, stok, koin dan shift aktual dengan semantik tanggal terdokumentasi. |
| P4 | Endpoint promo/konfigurasi operasional | Hanya setelah aturan promo, mesin, koin dan waktu shift disepakati. Integrasi Sheets terpisah dan opsional. |

## 9. Alur transaksi yang direkomendasikan

1. Kasir dengan role yang sah memuat katalog layanan/produk dan sesi shift terbuka dari API; jika katalog gagal, UI tidak boleh menyajikan harga lokal seolah dapat disimpan.
2. Kasir membuat satu atau lebih kelompok cucian dan produk tambahan. Frontend melakukan validasi dasar; backend tetap menjadi otoritas berat, unit, harga, diskon, jumlah mesin, koin, stok, dan outlet.
3. Pengguna meninjau subtotal, diskon/ongkir, total, dan metode bayar. QRIS yang belum diverifikasi harus berstatus menunggu/belum lunas, bukan sukses.
4. Frontend mengirim idempotency key unik per upaya checkout. Server memvalidasi shift masih terbuka, mengunci stok/koin yang relevan, menghitung ulang snapshot harga menggunakan waktu Asia/Jakarta, dan memastikan layanan dalam grup tidak konflik.
5. Satu database transaction menyimpan customer/order, transaksi, item/grup, status pembayaran, payment yang benar-benar diterima, pengurangan stok beserta mutasi, pengeluaran koin beserta ledger, delivery dan nomor transaksi.
6. Server mengembalikan nomor transaksi dan resource detail. Frontend hanya mengosongkan keranjang sesudah respons sukses; kegagalan harus mempertahankan semua input untuk retry aman.
7. Tampilkan konfirmasi dengan nomor transaksi dan tautan ke detail. Riwayat, pesanan, laporan shift dan Owner membaca sumber data yang sama melalui endpoint aktual.
8. Ketika terjadi pembatalan/refund, jangan menghapus mutasi; buat reversal/refund yang terlacak sesuai kebijakan dan rekonsiliasi stok/koin/pembayaran.

### Kondisi yang sudah diterapkan sekarang

Checkout sudah melakukan perhitungan harga server-side, mengunci shift, mengunci baris produk untuk validasi stok, menulis transaksi/item/pembayaran/mutasi stok dalam satu PDO transaction, lalu commit. Frontend mempertahankan cart saat request gagal dan mengosongkannya hanya setelah respons sukses. Namun status bayar selalu lunas, tidak ada idempotency key, tidak ada record customer untuk checkout, dan layanan Drop Off belum menyimpan berat/catatan.

## 10. Aturan shift dan rekonsiliasi

- Pisahkan **definisi jadwal** dari **sesi aktual**. Jadwal yang disebut pengguna adalah pagi 06.00–12.00, siang 13.00–18.00, sore 19.00–00.00, malam 01.00–06.00 WIB. Sistem saat ini tidak memuat `sore` dan jam-jam tersebut tidak disimpan sebagai konfigurasi.
- Simpan zona waktu `Asia/Jakarta` secara eksplisit untuk interpretasi jadwal; timestamp sesi tetap menyimpan waktu absolut. Hitung `operational_date` secara deterministik untuk sesi malam dan batas tengah malam.
- Buka shift dan tutup shift tetap aksi manual. Akhir jadwal hanya memicu peringatan yang ditandai/dideduplikasi per sesi; tidak menutup sesi otomatis.
- Tindakan buka/tutup harus mengambil lock sesi untuk menghindari transaksi bersamaan dengan close. Endpoint transaksi saat ini sudah mengunci shift terbuka; flow baru harus mempertahankan perlindungan concurrency ini.
- Pembayaran dikelompokkan ke sesi penerima melalui `payments.shift_id`, bukan sekadar sesi ketika order dibuat. Rekap membedakan nilai order, jumlah pembayaran diterima, metode, dan sisa belum lunas.
- Saat close, hitung dan simpan: saldo kas awal bila laci memiliki saldo awal, pembayaran tunai masuk, pengeluaran/refund tunai yang terkonfirmasi, saldo sistem, hitung fisik, selisih, saldo awal koin, koin masuk/keluar, saldo sistem, hitung fisik, selisih, aktor, waktu dan catatan serah terima.
- Jangan menafsirkan endpoint close sekarang sebagai rekonsiliasi lengkap: ia hanya merangkum nominal `payments` tunai/QRIS serta jumlah payment, kemudian menutup shift.
- Empat jenis shift merupakan perubahan skema/API/UI yang perlu persetujuan. Tidak boleh mengonversi harga malam berdasarkan jenis shift.

## 11. Mesin, satuan harga, dan koin

### Harga yang dapat dibuktikan dari seed

| Katalog | Satuan pada database | Keterangan |
|---|---|---|
| Self Service Cuci/Kering/Cuci + Kering/Extra Spin/Extra Dry | `siklus` | Ditagihkan berdasarkan kuantitas siklus. |
| Drop Off Cuci + Kering | `muatan` | Bukan tarif per kg pada seed. |
| Drop Off Lipat, Cuci Kering Setrika, Setrika | `kg` | Harus menggunakan berat aktual; checkout saat ini tidak mengirimkannya. |
| Tarif malam | `service_prices` dengan `price_type='malam'` | Seed memberi rentang 23:00–06:00 pada dua layanan. Backend menggunakan Asia/Jakarta dan jendela jam yang hardcoded. |

Harga di tabel seed hanya inventaris data repo, bukan usulan nominal baru. Backend menghitung `harga × quantity`; harga untuk beberapa mesin belum terdefinisi selain mekanisme kuantitas umum. Minta konfirmasi apakah satu unit/siklus berarti satu mesin, satu muatan, satu kelompok, atau aturan lain.

### Mesin dan koin

- UI menyebut kapasitas maksimal mesin cuci 7 kg dan menggambarkan waktu koin reguler: 30 menit cuci atau 45 menit pengering; Extra Dry menambah 20 menit. Ini keterangan UI, belum merupakan konfigurasi/aturan server.
- Belum ada data terstruktur tentang kapasitas pengering. Jangan menganggap kapasitas pengering 7 kg.
- Formula yang diminta untuk mesin cuci (`ceil(berat_kg / 7)`) dapat diterapkan hanya setelah disetujui sebagai aturan kapasitas dan pembulatan untuk layanan terkait; berat wajib lebih dari nol.
- Konfirmasi apakah hasil pembulatan berlaku terpisah per kelompok, apakah layanan cuci saja/kering saja/cuci+kering eksklusif per kelompok, dan apakah beberapa kelompok berbeda boleh berada di satu transaksi.
- Belum ada jumlah koin per jenis layanan yang dapat dibuktikan dari database. Formula waktu UI bukan bukti jumlah koin operasional. Minta tabel aturan untuk cuci, kering, kombinasi, Extra Dry, dan koreksi manual.
- Pengeluaran koin harus berada di transaksi DB yang sama dengan transaksi/order; gunakan referensi unik agar retry tidak mengurangi dua kali. Simpan ledger, bukan hanya menimpa `coin_types.stock`.

## 12. Produk dan stok

- Produk jual yang terdaftar pada `products` memiliki harga, stok, unit, kategori, dan status aktif; `GET /api/products` menyediakannya ke Kasir.
- Saat checkout, backend mengunci row produk, memeriksa stok cukup, menyimpan item penjualan, mengurangi stok, dan menulis `inventory_movements` tipe `keluar` dalam transaksi yang sama. Constraint stok tidak boleh negatif memberi lapis perlindungan tambahan.
- Jalur tersebut tidak dipakai halaman `InventoryManagement`, yang saat ini sepenuhnya mock. Mutasi stok masuk/penyesuaian, daftar histori, batas minimum, dan sinkronisasi ulang stok perlu endpoint.
- Mutasi manual harus memiliki kuantitas positif, tipe masuk/keluar/penyesuaian yang jelas, alasan wajib, petugas, waktu, dan aturan stok minimum/negatif yang disetujui. Perubahan saldo dan ledger dilakukan atomik.
- Bedakan produk yang dijual kepada pelanggan dari bahan operasional internal (misalnya deterjen untuk pemakaian laundry). Skema `products` saat ini menunjukkan produk jual; belum ada model konsumsi bahan per order. Jangan mengurangi bahan internal berdasarkan transaksi sebelum daftar bahan dan aturan penggunaan disepakati.
- Pastikan Owner dan Kasir membaca stok yang sama dan melakukan refresh/invalidation setelah transaksi atau koreksi.

## 13. Pesanan, riwayat, dan integrasi Owner

### Pesanan dan riwayat

- Pisahkan status pengerjaan pada `laundry_orders.status` dari status pembayaran pada `transactions.payment_status`. UI pesanan sudah menampilkan dua konsep, namun berasal dari mock.
- Endpoint list/detail harus memfilter tanggal, sesi shift, status pengerjaan, status pembayaran, metode pembayaran, nomor transaksi, serta outlet dengan pagination. Filter payment method harus membaca payment record, bukan menebak dari status.
- Pesanan yang berhasil dibuat harus menyimpan relasi pelanggan, berat, layanan/grup, catatan, estimasi jika tersedia, delivery jika berlaku, dan snapshot transaksi. Transisi status harus divalidasi server dan masuk ke history.
- Riwayat aktual harus membaca item dan harga snapshot, payment, pelanggan, serta timestamp dari backend. Jangan tampilkan mock fallback sebagai transaksi aktual.

### Owner

- Dashboard dan laporan Owner telah memakai API/database untuk pendapatan, transaksi, pembayaran, attendance dan pesanan; tidak semua halaman Owner adalah mock.
- API dashboard dan finance belum membatasi data berdasarkan `outlet_id` meskipun relasi outlet tersedia. Tambahkan konteks outlet yang diotorisasi dari user/session; jangan percaya `outlet_id` bebas dari client.
- Dashboard perlu mengagregasi nilai transaksi lunas dan pembayaran yang diterima dengan definisi tanggal yang terpisah/terdokumentasi. Ringkasan shift harus berdasarkan payment penerima; pendapatan transaksi boleh tetap berdasarkan waktu order bila itu metrik yang disepakati.
- Tambahkan data stok, penjualan produk, mutasi stok, koin, order, dan rekap shift hanya melalui endpoint aktual. Jika sumber belum tersedia, tampilkan “belum tersedia”, bukan angka placeholder.
- Saat create/update transaksi berhasil, dashboard perlu refresh atau menerima mekanisme invalidasi yang tidak membutuhkan perubahan API eksternal.

## 14. Risiko perubahan

1. Perubahan constraint `shift_type` atau kolom baru tanpa migrasi terurut dapat gagal pada database yang telah memiliki data.
2. Perubahan skema pembayaran dari satu payment ke multi-payment berdampak pada query Owner, laporan, penutupan shift, dan histori; perlu keputusan bisnis sebelum dilakukan.
3. Checkout mengubah beberapa aggregate sekaligus. Penulisan non-atomik dapat menyebabkan transaksi tanpa stok/payment/order atau mutasi ganda.
4. Retry jaringan dan double submit dapat menggandakan penjualan, koin, dan pengurangan stok tanpa idempotensi.
5. QRIS palsu-terkonfirmasi menimbulkan risiko selisih uang; status pembayaran tidak boleh diubah menjadi lunas tanpa kebijakan verifikasi eksplisit.
6. Scope outlet yang tidak konsisten berisiko mencampur data atau menampilkan data outlet lain.
7. Mengubah arti quantity untuk layanan berbasis kg/siklus dapat mengubah total transaksi; validasi lama dan snapshot harga wajib diuji.
8. Pergantian hari, rentang jadwal yang melewati tengah malam, timezone PHP/PostgreSQL dan rentang laporan dapat menghasilkan rekap salah bila zona waktu tidak eksplisit.
9. Memperbarui halaman mock ke API membutuhkan loading/error/empty states dan menjaga tampilan saat request gagal; fallback ke data contoh tidak boleh menyamar sebagai data aktual.
10. Data pelanggan dan catatan menambah kewajiban akses/retensi; batasi field yang disimpan dan otorisasi akses detail.
11. Tidak ada Git metadata pada root workspace dalam pemeriksaan ini. Rencana rollback implementasi harus berupa migrasi forward/rollback teruji dan backup terkontrol, bukan mengandalkan `git checkout`.

## 15. Rencana pengujian

Tidak ada test runner aplikasi yang ditemukan pada `package.json`; script yang tersedia hanya `dev`, `build`, dan `preview`. Untuk implementasi, tambahkan pengujian dalam tool/test harness yang disetujui atau gunakan fasilitas yang sudah tersedia di lingkungan deploy, tanpa memasang dependency sebelum persetujuan.

### P0 — transaksi dan pembayaran

- Uji tunai pas, uang kurang, kembalian, QRIS menunggu verifikasi, transaksi belum lunas, dan pembayaran yang kemudian diterima.
- Uji request duplikat/retry dengan idempotency key yang sama; hanya satu transaksi, payment dan efek stok/koin terjadi.
- Uji validasi server atas ID item, status aktif, harga, total, diskon, ongkir, customer, shift/outlet, serta manipulasi payload harga dari client.
- Simulasikan kegagalan di setiap tahap penyimpanan; pastikan seluruh DB transaction rollback dan cart tetap ada di UI.
- Pastikan nomor transaksi unik pada request serentak, serta respon sukses berisi nomor dan detail yang dapat dibuka.

### P1 — kelompok layanan, mesin, koin, stok

- Berat kosong, nol, negatif, pecahan, batas kapasitas dan pembulatan mesin; jalankan kasus satu dan beberapa kelompok.
- Tolak layanan yang saling eksklusif pada kelompok yang sama, tetapi izinkan kelompok berbeda sesuai aturan terkonfirmasi.
- Verifikasi per satuan `siklus`, `muatan`, `kg`, normal/malam, satu dan banyak mesin tanpa mengubah nominal seed.
- Uji pengeluaran koin satu kali pada retry, saldo koin cukup/tidak cukup, ledger masuk/keluar/koreksi, alasan dan petugas.
- Uji stok produk tepat habis, tidak cukup, dua checkout bersamaan, penyesuaian fisik, dan kesesuaian saldo dengan ledger.

### P2 — shift dan laporan

- Buka/tutup manual, shift yang melewati tengah malam, empat jenis setelah disetujui, operasional date, dan satu shift terbuka per kasir.
- Pastikan peringatan jadwal akhir tidak berulang dan tidak menutup shift otomatis.
- Uji transaksi bersamaan dengan close shift; transaksi tidak boleh tercatat pada sesi yang sudah ditutup atau hilang dari rekap.
- Rekonsiliasi kas/koin: saldo awal + masuk - keluar = saldo sistem; hitung fisik menghasilkan selisih yang tersimpan.
- Bandingkan laporan berdasarkan tanggal order dan tanggal pembayaran, pembayaran belum lunas, metode, sesi penerima, petugas, serta transfer serah terima.

### P3/P4 — Owner dan penyempurnaan

- Uji outlet A/B untuk memastikan dashboard, finance, layanan, orders, stok, koin, attendance dan outlet settings hanya memakai scope terotorisasi.
- Cocokkan KPI/grafik dengan query SQL fixture, termasuk Asia/Jakarta dan batas periode.
- Uji filter, paging, empty/loading/error, ekspor, transaksi/order detail, dan refresh sesudah checkout.
- Uji light/dark mode dan reduced motion yang telah ada; pastikan tidak ada regression visual dari integrasi.
- Jalankan `npm run build`, pemeriksaan PHP/lint yang tersedia, validasi migrasi di database sementara, lalu smoke test browser lintas role. Uji operasi kritis pada database PostgreSQL uji, bukan data produksi.

## 16. Pertanyaan aturan bisnis yang perlu dikonfirmasi

1. **Dikonfirmasi:** jadwal Pagi 06.00–12.00, Siang 13.00–18.00, Sore 19.00–00.00, dan Malam 01.00–06.00. Jadwal disimpan; sesi tetap manual.
2. **Dikonfirmasi sebagian:** tanggal operasional shift malam mengikuti tanggal mulai jadwal. Aturan tanggal operasional untuk shift sore yang melewati tengah malam masih perlu dipastikan.
3. **Dikonfirmasi:** peringatan akhir shift diinginkan. Implementasi berikutnya mengasumsikan 30 menit sebelum jadwal berakhir dan sekali per sesi; penerima/kanal masih perlu ditentukan.
4. Apakah serah terima mengakhiri sesi lama dan membuka sesi baru, serta data apa yang wajib disetujui kedua petugas?
5. **Dikonfirmasi:** kapasitas cuci dan pengering masing-masing 7 kg; jumlah mesin `ceil(berat/7)`.
6. **Dikonfirmasi:** harga Self Service per siklus dikalikan jumlah mesin. Seed lain tetap mengikuti unit tarifnya (`kg`/`muatan`).
7. **Dikonfirmasi:** satu koin reguler per mesin, dua koin reguler per pasangan mesin Cuci + Kering, dan satu koin khusus per pengering Extra Dry. Arti angka “30” yang disebut untuk koin Extra Dry (saldo fisik awal atau durasi) belum dipakai untuk mengubah data/konfigurasi; saldo tetap mengikuti database.
8. Apakah layanan Cuci saja/Kering saja/Cuci+Kering eksklusif hanya per kelompok cucian? Apakah satu transaksi boleh mempunyai beberapa kelompok dengan layanan berbeda?
9. Drop Off: kapan berat ditimbang, apakah pembayaran dapat ditunda sampai berat final, bagaimana tarif muatan vs kg dihitung, dan field pelanggan wajib apa?
10. Apakah satu transaksi dapat menggunakan beberapa diskon/ongkir? Apa batas, peran yang boleh memberi diskon, dasar perhitungan, alasan wajib, dan aturan pembulatan? Nilai harga/nominal diskon tidak diasumsikan dalam rencana ini.
11. **Dikonfirmasi:** belum ada provider QRIS; kasir dapat mengonfirmasi penerimaan manual. Sistem mencatat petugas/waktu dan tidak menyebutnya verifikasi provider.
12. Apakah pembayaran cicilan, split tunai/QRIS, refund, pembatalan sesudah payment, atau pelunasan di shift lain diperlukan? Satu payment per transaksi saat ini adalah batas skema.
13. Produk mana yang dijual kepada pelanggan dan mana yang merupakan bahan operasional internal? Apakah stok boleh negatif atau wajib ditolak selalu?
14. **Dikonfirmasi:** hanya outlet aktif ini yang ditampilkan Owner. Query Owner dibatasi ke satu outlet aktif; data katalog stok/koin belum punya relasi outlet terpisah.
15. Definisi “pendapatan” Owner: transaksi lunas berdasarkan waktu order atau pembayaran diterima berdasarkan waktu payment? Apakah order belum lunas masuk grafik pendapatan?
16. Apakah koreksi koin/stok membutuhkan persetujuan Owner, alasan wajib, batas nilai, atau lampiran bukti? Siapa yang mengesahkan hitung fisik saat shift ditutup?
17. Apakah nomor telepon pelanggan unik/opsional, dan apakah perlu snapshot identitas pada transaksi jika profil pelanggan berubah di masa mendatang?

## 17. Prioritas implementasi

| Prioritas | Hasil yang dituju | Dependensi utama |
|---|---|---|
| **P0 — Penyimpanan transaksi dan pembayaran** | **Diimplementasikan:** persistensi checkout, idempotensi, tunai/QRIS manual, pelunasan tertunda, riwayat aktual, detail dan kegagalan tanpa menghapus cart. | E2E setelah katalog/coin stock lokal tersedia; partial/split dan refund tetap belum didukung. |
| **P1 — Perhitungan mesin, koin, dan stok produk** | **Diimplementasikan:** kapasitas 7 kg, harga per mesin, koin otomatis idempoten, stok atomik, ledger dan koreksi beralasan. | Beberapa kelompok cucian per transaksi dan arti angka 30 masih belum diputuskan. |
| **P2 — Shift, laporan, dan rekonsiliasi** | **Sebagian diimplementasikan:** empat jadwal, buka/tutup manual, laporan penerimaan per shift, transaksi belum lunas, penggunaan koin, dan agregasi expense per shift pada database lokal. | Tanggal operasional, peringatan non-berulang, handover, dan rekonsiliasi kas/koin fisik masih belum lengkap. Migration expense belum diterapkan ke produksi. |
| **P3 — Integrasi dashboard Owner** | **Diimplementasikan untuk satu outlet aktif:** data order/pembayaran/shift/stok/koin aktual, filter outlet dan metrik yang membedakan nilai transaksi vs penerimaan. | Tambah relasi outlet ke tabel inventaris/koin bila sistem berkembang ke banyak outlet. |
| **P4 — Penyempurnaan fitur tambahan** | **Belum lengkap:** ekspor/cetak aktual, pengiriman lengkap, promo, integrasi eksternal, dan audit lanjutan. | Aturan bisnis dan prioritas produk. |

## 18. File implementasi dan area lanjutan

### Diubah untuk integrasi ini

- Frontend: `src/features/cashier/CashierApp.jsx`, `src/features/cashier/data/catalog.js`, `src/features/cashier/components/CashierDashboard.jsx`, `src/features/cashier/components/TransactionHistory.jsx`, `src/features/cashier/components/OrderManagement.jsx`, `src/features/cashier/components/InventoryManagement.jsx`, `src/features/cashier/components/CoinManagement.jsx`, `src/features/cashier/components/ShiftReports.jsx`, `src/features/cashier/styles/checkout.css`, `src/features/cashier/styles/cashier-redesign.css`, `src/features/cashier/styles/expense-report.css`, `src/features/cashier/styles/inventory-expense.css`, `src/features/owner/components/OwnerDashboard.jsx`, `src/features/owner/components/OwnerModule.jsx`, `src/shared/api.js`, `src/shared/ExpenseManagement.jsx`, dan `src/shared/expense-management.css`.
- Backend/database: `api/public/index.php`, `database/schema.sql`, migrasi `database/migrations/20261031_001_integrated_checkout.sql`, serta migration expense yang diterapkan pada database lokal saja.
- Dokumentasi: `PROGRESS.md` dan `docs/FULL_SYSTEM_INTEGRATION_PLAN.md`.

### Lanjutan yang masih diperlukan

- Sediakan katalog layanan Self Service dan jumlah saldo koin uji yang benar di database pengembangan, lalu lakukan smoke test browser/login lintas role serta checkout lengkap, pelunasan tunai/QRIS, retry, stok bersamaan, dan laporan.
- Tetapkan makna angka 30 untuk Extra Dry dan aturan tanggal operasional, pengingat shift, serah terima, serta rekonsiliasi fisik sebelum melanjutkan P2.
- Uji migrasi serta query pada staging/DB sementara sebelum deploy; jangan menjalankan migrasi ke produksi tanpa backup dan persetujuan rilis.
- Evaluasi kebutuhan beberapa kelompok cucian per transaksi, partial/split payment, refund, ekspor/cetak aktual, dan outlet scope bila jumlah outlet bertambah.

## 19. Addendum — Revisi Owner P0

- Implementasi code expense disiapkan setelah persetujuan untuk melanjutkan revisi. `database/migrations/20261101_001_expense_ledger.sql` menambahkan tabel `expenses`, `expense_audit`, tautan `inventory_movements.expense_id`, dan kunci idempotensi penerimaan stok. `database/schema.sql` diperbarui sebagai schema fresh-install.
- Endpoint Owner/Kasir memvalidasi role, outlet, CSRF, metode/sumber, file bukti dan idempotensi. Bukti wajib berformat JPG/PNG/WebP/PDF, maksimal 5 MB, nama acak dan disimpan pada `api/private/expenses`, bukan document root. Owner dapat mengoreksi dengan alasan; perubahan lama/baru tersimpan dan bisa dibaca.
- Laporan finance memakai waktu transaksi untuk nilai transaksi, `payments.paid_at` untuk penerimaan, dan `expenses.created_at` untuk biaya. Arus kas bersih dihitung terpisah dan diberi label bukan laba. Laporan shift menambahkan pengeluaran terhubung, termasuk bagian dari laci kas. Sumber dana QRIS dikonfirmasi sebagai rekening usaha.
- Kasir mendapat menu Pengeluaran. Penerimaan stok tetap alur terpisah; expense pembelian dapat ditautkan pada mutation dan retry receipt tidak menambah stok ganda.
- Filter kuartal di Dashboard Owner dan Laporan Keuangan dihapus. Periode rolling 7 hari diberi label `7 hari terakhir`.
- Migration diterapkan hanya pada database lokal `KinoKoinLoundry` setelah persetujuan eksplisit; produksi tidak dimigrasikan. Tidak ada data bisnis yang dibuat atau diubah secara permanen.
- Verifikasi kode: build Vite dan `php -l` untuk API/bootstrap berhasil. Uji rollback-only lokal membuktikan insert/agregat, audit, penolakan idempotency duplikat, batas sumber QRIS, dan rollback tanpa fixture tersisa. Upload bukti dan API end-to-end dengan sesi autentik masih perlu diuji. Penugasan karyawan/shift, rekonsiliasi fisik, P2 (CRUD produk/promo), dan P3 (Sheets/foto) tetap menunggu tahap implementasi masing-masing.

## Pembaruan P1 — akun karyawan untuk absensi

- Owner dapat melihat dan membuat akun karyawan melalui halaman Karyawan & Shift.
- Endpoint `GET/POST /api/owner/employees` hanya dapat diakses Owner; pembuatan membutuhkan CSRF, mengikat akun ke outlet aktif, mengunci role menjadi `karyawan`, memvalidasi username/email, dan menyimpan kata sandi dengan `password_hash`.
- Tidak ada perubahan schema/migration: tabel `users` sudah mendukung role tersebut. Login yang sudah ada menerima username/email dan mengarahkan role `karyawan` ke halaman absensi.
- Akun yang dibuat tidak mendapatkan akses Owner/Kasir. Edit/nonaktif/reset sandi, riwayat per orang, assignment pada sesi shift, dan rekonsiliasi masih belum termasuk.

Audit awal tetap menjadi baseline historis. Implementasi sudah berjalan; status terkini, validasi, dan batas fitur dicatat pada bagian awal dokumen ini.
