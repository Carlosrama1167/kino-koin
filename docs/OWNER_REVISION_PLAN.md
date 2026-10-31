# Rencana Revisi Sistem Owner — KINO Laundry POS

**Status:** P0 pengeluaran dan laporan diimplementasikan; migration diterapkan hanya pada database lokal `KinoKoinLoundry` setelah persetujuan eksplisit. Database produksi tidak diubah.  
**Tanggal audit:** 31 Oktober 2026  
**Cakupan verifikasi database:** database pengembangan lokal `KinoKoinLoundry`; bukan database produksi.

Dokumen ini merencanakan revisi Owner tanpa mengganti desain yang sudah ada. Kondisi di bawah diverifikasi terhadap React, front controller PHP, SQL schema/migration, dan hitungan agregat database lokal. Database produksi tidak diakses.

## 1. Kondisi fitur Owner saat ini

Portal Owner memakai navigasi di `src/features/owner/components/OwnerPortal.jsx`. Halaman utama:

| Fitur | Kondisi aktual |
|---|---|
| Dashboard Owner | Membaca `/api/owner/dashboard`: pendapatan transaksi lunas, pembayaran menurut metode, status pesanan, grafik, layanan terlaris, stok/koin, absensi hari ini, transaksi dan shift terbaru. Nilainya berasal dari query PostgreSQL; bukan mock pada halaman ini. |
| Ringkasan kuartal | Tidak ada panel tersendiri bernama rekapitulasi kuartal; filter `Kuartal` pada Dashboard dan Laporan Keuangan telah dihapus dari UI dan validasi periode API. |
| Laporan Keuangan | Membaca `/api/owner/finance` untuk transaksi, status pembayaran, metode, total pendapatan lunas dan pembayaran tercatat. Kode mendukung expense dan pemisahan basis tanggal; ledger tersedia pada database lokal setelah migration. Produksi belum dimigrasikan. |
| Karyawan & Shift | Menampilkan absensi aktual dari `/api/attendance`, daftar akun karyawan, serta form Owner untuk membuat akun login ber-role `karyawan`. Akun menggunakan login/halaman absensi yang sudah ada. Edit, nonaktifkan, reset sandi, dan riwayat shift per karyawan belum tersedia. |
| Harga layanan | Membaca `services` dan `service_prices` melalui `/api/owner/services`; perubahan harga normal/malam disimpan melalui `/api/owner/services/price`. Snapshot harga transaksi yang sudah tersimpan tidak berubah. |
| Produk & stok | Dashboard Owner hanya membaca ringkasan/daftar produk. Pengelolaan dan mutasi stok aktual saat ini berada di Kasir. Belum ada CRUD produk di Owner. |
| Promo | Belum tersedia. UI menyatakan belum ada tabel atau endpoint promo. |
| Google Sheets | Halaman hanya menampilkan status “belum terhubung”. Belum ada konfigurasi, worker, endpoint, maupun riwayat sinkronisasi Google Sheets. |
| Profil dan foto | Pengaturan Owner saat ini mengubah nama/alamat/telepon outlet melalui `/api/owner/outlet`. Tidak ditemukan pengaturan profil pengguna atau foto. |

### Pemeriksaan database lokal

Query metadata dan agregat baca-saja pada `KinoKoinLoundry` menunjukkan:

- Tabel operasional yang ada meliputi `users`, `shifts`, `shift_schedules`, `employee_attendance`, `services`, `service_prices`, `products`, `transactions`, `transaction_items`, `payments`, `laundry_orders`, `coin_movements`, `inventory_movements`, dan `sync_jobs`.
- Tidak ditemukan tabel pengeluaran, promo, membership, atau rekonsiliasi kas fisik.
- Ada 12 layanan aktif dan 0 produk.
- Ada 1 akun Owner aktif dan 1 akun Kasir aktif; belum ada akun Karyawan aktif.
- Belum ada data absensi dan belum ada baris `sync_jobs`; tercatat 1 shift terbuka saat audit.

Hitungan di atas hanya menggambarkan database lokal saat diperiksa. Tidak digunakan untuk menyimpulkan keadaan produksi.

## 2. Fitur yang sudah terhubung ke backend

| Kemampuan | Endpoint dan tabel |
|---|---|
| Login, role, aktivasi akun, password hash | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`; tabel `users`. Login mencari pengguna aktif dan menggunakan `password_verify`; pembuatan akun karyawan Owner menggunakan `password_hash` dan role tetap `karyawan`. |
| Ringkasan Owner | `GET /api/owner/dashboard`; transaksi, pembayaran, pesanan, kehadiran, katalog produk, koin dan shift. |
| Laporan transaksi Owner | `GET /api/owner/finance`; `transactions`, `payments`, `customers`. Satu pembayaran per transaksi didukung oleh constraint `payments.transaction_id UNIQUE`. |
| Akun karyawan Owner | `GET/POST /api/owner/employees`; `users`. Owner melihat akun dalam outlet aktif dan membuat akun karyawan dengan nama pengguna unik, kata sandi hash, dan role terkunci `karyawan`. |
| Daftar absensi Owner | `GET /api/attendance`; `users`, `employee_attendance`, `shifts`. Filter adalah tanggal, nama, shift. |
| Tarif layanan | `GET /api/owner/services`, `PUT /api/owner/services/price`; `services`, `service_prices`. |
| Informasi outlet | `GET /api/owner/outlet`, `PUT /api/owner/outlet`; `outlets`. Implementasi memilih outlet aktif pertama secara global. |
| Katalog produk POS | `GET /api/products`; Kasir membaca `products` yang aktif. |
| Mutasi stok | `GET/POST /api/inventory/movements`; `products`, `inventory_movements`. POST mendukung stok masuk dan koreksi, dengan alasan dan transaksi database. |
| Checkout dan mutasi stok jual | `POST /api/transactions`; `transactions`, `transaction_items`, `payments`, `inventory_movements`, `shifts`. Checkout idempoten dan mengurangi stok produk yang dijual secara atomik. |
| Shift | `POST /api/shifts/open`, `POST /api/shifts/close`, `GET /api/shifts/reports`; tabel `shifts`, `shift_schedules`, `payments`, `coin_movements`, dan transaksi terkait. Buka/tutup tetap manual. |

Semua endpoint Owner yang ditemukan memerlukan role `owner`; beberapa perubahan data memakai pemeriksaan CSRF. Detail auth, API client, dan alur transaksi dijelaskan di [rencana integrasi sistem](./FULL_SYSTEM_INTEGRATION_PLAN.md).

## 3. Fitur yang masih berupa dummy atau belum tersedia

- **Tidak ditemukan mock data operasional Owner yang dirender oleh halaman Owner aktif.** Dashboard, keuangan, absensi, tarif dan outlet menggunakan API. Data statis yang mungkin masih ada di `src/features/cashier/data/` bukan sumber Owner yang ditinjau.
- Kode P0 untuk UI Kasir/Owner, endpoint, laporan, audit koreksi, dan tautan stok sudah diterapkan. Schema tersedia pada database lokal; produksi belum dimigrasikan.
- UI Owner dapat membuat dan melihat akun `karyawan`; edit nama/login, aktif/nonaktif, reset sandi, dan riwayat shift per karyawan belum tersedia. Akun Owner/Kasir tidak dibuat melalui form ini.
- Daftar absensi ada, tetapi absensi tidak otomatis dikaitkan ke shift: endpoint check-in tidak mengisi `employee_attendance.shift_id`.
- Sesi shift hanya merekam `shifts.user_id` (akun yang login), jenis shift, waktu mulai/selesai, status. Tidak ada kolom karyawan yang bertugas atau tanggal operasional eksplisit.
- Produk tersedia pada schema dan dibaca POS; belum ada endpoint/UI Owner untuk membuat, mengubah, menonaktifkan, atau mengatur produk.
- Promo, membership, foto profil, dan integrasi Google Sheets belum memiliki implementasi backend.
- `sync_jobs` memang tersedia, tetapi belum dipakai aplikasi/endpoint yang ditemukan. Kolom `source_type` hanya mengizinkan `transaction`, `order`, `report`; tidak ada kunci deduplikasi unik atau uraian error terakhir.
- Penutupan shift meringkas pembayaran dan koin, tetapi belum menginput atau menyimpan hitung fisik kas/koin. Expense dari laci kas masuk perhitungan arus kas shift pada database yang telah dimigrasikan.

## 4. Daftar revisi UI yang direncanakan

1. Pilihan `Kuartal` sudah dihapus dari filter Dashboard dan Laporan Keuangan; API tidak lagi menerima nilai periode tersebut.
2. Periode yang tersedia `Hari ini`, `7 hari terakhir`, `Bulan ini`, dan `Kustom`. `7 hari terakhir` mempertahankan perilaku rolling 7 hari (`today - 6` sampai hari ini), bukan minggu kalender.
3. Pertahankan shell, navigasi, animasi, tema, tata letak, dan visual Owner yang ada. Tambahkan bagian/aksi seperlunya tanpa mengganti keseluruhan halaman.
4. Laporan menampilkan kartu terpisah: nilai transaksi lunas, pembayaran yang diterima, pengeluaran, dan arus kas bersih; basis tanggal dijelaskan dan arus kas bersih bukan laba. Ledger aktif pada database lokal yang telah dimigrasikan.
5. Form pengeluaran Kasir/Owner memakai receipt wajib dan endpoint idempoten. Penerimaan stok terpisah dapat ditautkan ke expense tanpa membuat mutasi stok kedua kali. Struktur DB diuji lokal secara rollback-only; upload bukti dan alur HTTP belum diuji end-to-end.
6. Kembangkan halaman Karyawan & Shift untuk manajemen akun, riwayat absensi, dan sesi shift dengan tetap mempertahankan tabel/filter yang sudah ada.
7. Kembangkan halaman harga/produk/promo di area Owner; produk POS tetap membaca satu katalog `products`.
8. Tambahkan status, sinkronisasi ulang, dan riwayat Sheets hanya setelah konfigurasi server tersedia. Pertahankan pesan “belum terhubung” sampai saat itu.
9. Tambahkan ubah foto pada pengaturan profil Owner setelah endpoint upload dan penyimpanan aman tersedia.

## 5. Rancangan pengeluaran Kasir dan Owner

### Alur yang disarankan

Kasir membuka Pengeluaran → memilih kategori → memasukkan nominal dan keterangan → memilih metode pembayaran dan sumber dana → (opsional/terkait) memilih detail barang yang diterima → mengonfirmasi → server menyimpan pengeluaran dan mutasi stok yang terkait dalam satu transaksi PostgreSQL → laporan shift/Owner membaca catatan tersimpan.

Owner dapat memakai alur yang sama tanpa shift, dengan petugas yang tercatat sebagai pengguna Owner. Akses riwayat/pengubahan mengikuti kebijakan audit; penghapusan fisik catatan keuangan tidak disarankan.

### Data minimum per pengeluaran

- ID dan ID outlet; waktu server.
- Kategori, nominal positif, keterangan.
- Metode pembayaran, misalnya tunai/QRIS/transfer (daftar final perlu disetujui).
- Sumber dana terpisah dari metode pembayaran, misalnya laci kas, rekening usaha, atau dana pribadi/penggantian.
- `shift_id` bila transaksi berlangsung dalam shift; identitas petugas aktual dan akun pencatat.
- Referensi bukti berkas opsional, disimpan dengan aturan upload aman.
- Kunci idempotensi/constraint server-side untuk mencegah double-submit.

Kategori awal yang diminta: pembelian sabun, pewangi, gas, perawatan mesin, dan lainnya. Cara pemeliharaan kategori (daftar tetap atau data kategori terkelola Owner) diputuskan sebelum migrasi.

### Konsistensi keuangan dan stok

- Pengeluaran tidak mengurangi nilai transaksi atau pembayaran penjualan. Empat metrik dilaporkan terpisah.
- `arus kas bersih = penerimaan pembayaran − pengeluaran kas pada periode yang sama`; ini bukan laba karena belum mengakui biaya nonkas, persediaan, kewajiban, atau periode akrual.
- Bila sumber dana adalah laci, pengeluaran mengurangi kas sistem yang diharapkan pada rekonsiliasi shift. Perlu saldo awal laci dan hitung fisik untuk menghasilkan selisih kas yang bermakna.
- Pembelian barang stok dicatat sebagai satu pengeluaran dengan satu atau lebih baris penerimaan inventaris terkait, dibuat atomik. Usulan relasi: kolom FK nullable `inventory_movements.expense_id`; setiap barang diterima menghasilkan satu mutasi stok. Jangan menambah stok dari endpoint pengeluaran umum lalu mengulanginya di endpoint stok.
- Ledger stok dan pengeluaran tetap terpisah secara akuntansi: satu invoice dapat membayar beberapa barang; kuantitas stok masuk tidak disamakan dengan nilai nominal biaya.

### Sumber tanggal laporan

Saat ini Finance Report memfilter transaksi dari `transactions.created_at`, lalu menghitung `payments` pada hasil transaksi tersebut. Untuk laporan baru, tampilkan:

- Nilai transaksi berdasarkan tanggal transaksi/order.
- Pembayaran diterima berdasarkan `payments.paid_at`.
- Pengeluaran berdasarkan waktu pencatatan/pembayaran pengeluaran.
- Arus kas berdasarkan waktu arus kas.

Aturan tanggal ini mencegah pelunasan transaksi lama dihitung sebagai penerimaan di periode yang salah. Backend saat ini satu pembayaran per transaksi; mendukung cicilan/split bukan bagian dari revisi tanpa keputusan bisnis dan rencana schema tersendiri.

## 6. Rancangan karyawan, satu akun Kasir, dan shift

### Akun dan identitas

- Gunakan `users` yang sudah ada untuk karyawan; role `karyawan`, `is_active`, dan `password_hash` sudah tersedia.
- Tambahkan UI Owner untuk daftar, buat, edit nama/username/email, aktif/nonaktif, dan reset sandi. Pengguna baru diberi role `karyawan` secara eksplisit; jangan membuat role Owner/Kasir sebagai default.
- Endpoint reset menghash sandi menggunakan `password_hash` dan tidak pernah mengembalikan atau mencatat sandi lama. Rancangan yang disarankan: password sementara satu kali dan wajib diganti; perlu metadata `must_change_password`/waktu perubahan serta endpoint pergantian sandi atau mekanisme reset yang setara.
- `current_user()` membaca ulang status aktif dari database pada setiap request, jadi akun nonaktif tidak akan tetap lolos otorisasi request berikutnya. UI tetap perlu memberi konfirmasi dan audit perubahan.
- Skrip `api/scripts/create_user.php` dan `create_initial_accounts.php` sudah menunjukkan pembuatan akun CLI dan hashing password, tetapi bukan pengganti API Owner.

### Akun Kasir bersama dan penugasan shift

Database lokal saat ini memiliki satu akun Kasir aktif. Namun schema hanya membatasi username/email unik dan satu shift terbuka per user; tidak melarang beberapa akun Kasir aktif. Kebijakan satu akun login harus ditegakkan dengan preflight data dan constraint/validasi yang sesuai, bukan dengan membuat akun per shift.

Untuk membedakan login bersama dari petugas sebenarnya:

- Pertahankan `shifts.user_id` sebagai akun login/pembuka sesi agar data lama tetap terbaca.
- Tambahkan `shifts.attendant_user_id` (nama final bebas) yang merujuk ke karyawan aktif yang ditugaskan. API buka shift memvalidasi role/outlet dan mengisi identitas ini.
- Sesi menyimpan ID unik yang sudah ada (`shifts.id`), tanggal operasional, jenis shift, waktu aktual buka/tutup, status dan petugas.
- Transaksi, pembayaran, pengeluaran dan mutasi koin mengaitkan operasi ke `shift_id`; laporan mengambil identitas petugas melalui shift. Catat juga `users.id` autentikasi sebagai actor untuk audit teknis.
- Jika pengeluaran tidak berasal dari shift aktif, petugas harus tetap jelas (misalnya Owner yang login); Kasir bersama tidak cukup menjadi identitas individu.
- Check-in karyawan dapat ditautkan ke shift saat ada sesi aktif dan petugas cocok. Tidak boleh mengarang relasi absensi yang tidak dikirim saat ini.

### Tanggal operasional, jadwal, dan reminder

`shift_schedules` sudah menyimpan empat jadwal dalam `Asia/Jakarta`: pagi 06.00–12.00, siang 13.00–18.00, sore 19.00–00.00, malam 01.00–06.00. `shifts` menyimpan waktu aktual dan buka/tutup manual; tidak ada auto-close.

Rencana mempertahankan jadwal tersebut dan menambahkan pengingat sekali per sesi menjelang akhir jadwal, tanpa menutup shift. Hitung waktu dari konfigurasi `shift_schedules`, bukan dari `shift_type` atau harga malam. Simpan `operational_date` pada sesi untuk filter laporan; aturan tanggal untuk shift sore yang melewati tengah malam perlu diputuskan (tanggal jadwal dimulai atau tanggal aktual buka).

### Rekonsiliasi

Tabel `shifts` dan ledger `payments`/`coin_movements` memungkinkan agregat sistem; tidak ada kolom/tabel hitung fisik. Rancangan minimal aditif:

- Input saldo awal kas ketika shift dibuka.
- Saat tutup, hitung penerimaan tunai/QRIS berdasarkan waktu dan shift penerima serta pengeluaran dari laci.
- Simpan ekspektasi kas, hitung fisik, selisih, petugas penutup, dan waktu penutupan.
- Untuk tiap jenis koin, simpan saldo sistem dan hitung fisik/selisih dalam tabel detail rekonsiliasi yang terhubung ke shift.
- Jangan menimpa atau menghapus ledger; selisih/koreksi menjadi catatan baru dengan alasan dan actor.

Nilai saldo awal laci, mekanisme penyerahan uang/koin antarshift, dan apakah Owner dapat menutup atas nama petugas masih perlu persetujuan.

## 7. Rancangan pengelolaan produk

Gunakan `products` yang sama dengan POS, bukan katalog Owner baru. Tabel yang ada sudah berisi `name`, `category`, `price`, `stock`, `minimum_stock`, `unit`, `is_active`; `GET /api/products` dipakai Kasir, dan checkout memvalidasi stok serta membuat mutasi.

Tambahkan endpoint Owner untuk daftar lengkap, create, update, active/inactive. Validasi nama, kategori, harga, satuan, stok, dan perubahan status di backend; penjualan memakai ID produk dan harga/stok yang dikonfirmasi server.

Kategori contoh dapat menjadi nilai kategori pada katalog bersama: Makanan, Minuman, Sabun, Pewangi, Plastik, Produk lainnya. Belum ada tabel kategori. Sebelum implementasi, tentukan apakah kategori tetap atau perlu CRUD sendiri.

Tabel saat ini selalu menganggap produk memiliki jumlah stok numerik. Jika produk tertentu tidak melacak stok, gunakan kebijakan eksplisit seperti kolom `tracks_stock` aditif; jangan mengartikan stok 0 sebagai “tidak dilacak”, sebab checkout saat ini menolak stok yang kurang.

Barang masuk melalui penerimaan stok dan `inventory_movements`; produk fisik yang dibeli memakai relasi ke pengeluaran seperti di bagian 5. Aktivasi produk yang sudah ada harus memengaruhi POS pada request berikutnya, tanpa katalog duplikat atau hardcode nama produk di frontend.

## 8. Rancangan promo

Belum ada tabel promo/membership, endpoint, atau fitur membership yang ditemukan. Harga normal/malam saat ini memakai `services` dan `service_prices`; checkout mengambil harga dari server. Promo tidak boleh ditumpuk atau disimpulkan dari label malam.

Setelah aturan disepakati, rancangan dapat memakai tabel `promotions` (nama, tipe, nilai, periode, status, syarat) serta tabel eligibility untuk layanan/produk, kemudian menyimpan referensi dan snapshot diskon pada transaksi. Bila satu promo berlaku untuk beberapa target, join table mencegah daftar ID tidak tervalidasi. Backend wajib memvalidasi masa aktif, kelayakan, batas diskon dan total; frontend hanya meminta kalkulasi/konfirmasi server.

Belum boleh menetapkan jenis persen/nominal, batas penggunaan, penggunaan berulang, batas maksimum, prioritas, promo malam, promo membership, ataupun kombinasi promo tanpa persetujuan Owner. Jangan mengaktifkan diskon bertumpuk sebelum kebijakan dipilih.

## 9. Rancangan integrasi Google Sheets

PostgreSQL tetap sumber data utama dan Sheets bersifat ekspor/laporan satu arah. Jangan memberi kemampuan edit transaksi dari Sheets.

`sync_jobs` dapat dipakai sebagai dasar outbox, bukan membuat tabel job duplikat tanpa evaluasi. Saat ini status `pending/success/failed`, jumlah percobaan dan timestamp sudah ada, tetapi tipe sumber hanya `transaction/order/report`; tidak ditemukan worker/route yang memprosesnya, config Google, kunci idempotensi, atau error terakhir.

Rancangan:

1. Simpan konfigurasi dan kredensial Google hanya di secret store/environment server. Jangan kirim ke React, database log, atau repository.
2. Tambahkan event outbox secara atomik dengan transaksi bisnis untuk transaksi/pembayaran, pengeluaran, dan laporan shift.
3. Tambahkan jenis sumber `payment`, `expense`, dan `shift` bila granular; isi ulang/buat pekerjaan untuk perubahan transaksi yang relevan.
4. Pekerja server melakukan upsert baris Google Sheets dengan key stabil (misalnya tipe + ID record + versi), bukan append buta. Ini membuat retry tidak menggandakan baris.
5. Simpan status, jumlah percobaan, timestamp, dan pesan kegagalan yang sudah disanitasi. Batasi retry dan sediakan sinkronisasi ulang terotorisasi.
6. Tampilkan status hanya jika koneksi dan izin spreadsheet sudah diuji. Jika konfigurasi tidak ada, tetap “belum terhubung”.

Tujuan awal: rekap transaksi, pendapatan/pembayaran, pengeluaran, shift, dan metode pembayaran. Kolom, tab, zona waktu, spreadsheet tujuan, kebijakan perubahan setelah sync, serta siapa yang boleh retry harus ditetapkan.

## 10. Rancangan upload foto profil

Belum ada kolom foto pada `users` atau endpoint upload. Rancangan aman:

- File diterima endpoint Owner dengan session + CSRF; otorisasi memastikan pengguna mengubah profilnya sendiri atau peran yang memang diizinkan.
- Validasi ekstensi, MIME yang terdeteksi server (`finfo`), signature/dekode gambar, ukuran maksimum, dan dimensi. Batas ukuran dan format final perlu disetujui; rekomendasi awal PNG/JPEG/WebP, maksimum 5 MB.
- Buat nama acak dari server; jangan percaya nama/ekstensi klien. Simpan di luar document root atau object storage privat, tanpa izin eksekusi. Layani melalui endpoint terkontrol; gunakan `Content-Type` yang benar dan `X-Content-Type-Options: nosniff`.
- Simpan hanya key/path aman di `users` melalui kolom aditif; hapus/ganti file lama setelah penyimpanan baru berhasil. Audit actor dan bersihkan berkas yatim.
- UI: pilih, pratinjau lokal, upload, simpan, ganti, hapus. Jangan mengubah login/session yang sudah berfungsi.

## 11. Perubahan API yang diperlukan

Semua route mutasi harus validasi role, outlet, CSRF, data batas, transaksi database bila ada beberapa tabel, dan idempotensi yang sesuai.

| Route rancangan | Akses | Tujuan |
|---|---|---|
| `GET /api/expenses` | Tersedia; Owner per outlet, Kasir hanya expense yang direkam sendiri | Daftar, rentang tanggal, limit, dan shift aktif; memerlukan migration ledger pada target deployment. |
| `POST /api/expenses` | Tersedia; Owner/Kasir + CSRF | Idempotensi, bukti wajib, kategori/metode/sumber tervalidasi; Kasir wajib shift aktif. |
| `GET /api/expenses/{id}` dan `/receipt` | Tersedia; Owner per outlet, Kasir milik sendiri | Detail dan audit koreksi; bukti privat di luar document root. |
| `PATCH /api/expenses/{id}` | Tersedia; Owner + CSRF | Koreksi dengan alasan dan audit old/new values; tidak ada hard delete. |
| `GET /api/owner/finance` (respons diperluas) | Tersedia; Owner | Metrik, transaksi/pembayaran/pengeluaran; basis tanggal transaksi, pembayaran, dan expense dibedakan. Ledger tersedia setelah migration diterapkan pada target. |
| `POST /api/shifts/open` (perluasan payload) | Kasir + CSRF | Terima `attendant_user_id`, validasi karyawan aktif, simpan tanggal operasional dan actor; tetap buka manual. |
| `POST /api/shifts/close` (perluasan payload) | Kasir + CSRF | Terima hitung kas/koin fisik dan persist rekonsiliasi atomik; tidak auto-close. |
| `GET /api/owner/employees` | Tersedia; Owner | Daftar akun karyawan dan status akun pada outlet aktif. |
| `POST /api/owner/employees` | Tersedia; Owner + CSRF | Buat akun role `karyawan` saja, hash kata sandi di server, outlet aktif; username/email duplikat ditolak. |
| `PATCH /api/owner/employees/{id}` | Owner + CSRF | Edit identitas dan aktivasi; jangan izinkan role escalation. |
| `POST /api/owner/employees/{id}/password-reset` | Owner + CSRF | Reset aman dan audit tanpa mengembalikan sandi yang disimpan. |
| `GET /api/owner/employees/{id}/attendance` | Owner | Riwayat absensi dengan rentang tanggal dan shift. |
| `GET /api/owner/employees/{id}/shifts` | Owner | Sesi shift yang ditugaskan dan ringkasan terkait. |
| `GET/POST/PATCH /api/owner/products` | Owner | CRUD katalog `products` yang sama dengan POS; batas stok dan harga server-side. |
| `GET/POST/PATCH /api/owner/promotions` | Owner | Ditambahkan setelah aturan promo dan migration disetujui. |
| `GET/POST /api/owner/profile/photo`; `DELETE` | Owner + CSRF | Upload/ganti/hapus foto profil secara privat dan tervalidasi. |
| `GET /api/owner/sheets/status`, `POST /api/owner/sheets/sync` | Owner + CSRF | Status, retry terkontrol; pemanggilan worker server-side, bukan akses credential dari browser. |

Nama/verb dapat disesuaikan dengan pola router yang sekarang hanya berupa pencocokan path di `api/public/index.php`.

## 12. Perubahan database/migrasi yang diperlukan

Migration expense aditif telah diterapkan pada database lokal `KinoKoinLoundry` setelah persetujuan pengguna. Produksi tidak diubah. Perubahan migration berikutnya tetap memerlukan preflight data dan persetujuan:

| Tahap migration | Usulan | Alasan / dampak |
|---|---|---|
| P0 pengeluaran | Diterapkan lokal: tabel `expenses` dengan outlet, nomor unik, kategori, nominal, keterangan, metode/sumber, shift nullable, actor, bukti wajib, idempotency key unik. Tabel `expense_audit` menyimpan koreksi. | Produksi belum dimigrasikan. Bukti maksimum 5 MB, MIME JPG/PNG/WebP/PDF, nama acak, storage privat. Sumber dana QRIS dikonfirmasi sebagai rekening usaha. |
| P0 pembelian stok | Disiapkan: FK nullable `inventory_movements.expense_id`, idempotency key dan request hash pada mutasi penerimaan. | Penerimaan stok terpisah dari expense; satu receipt tidak dapat menggandakan stok saat retry. |
| P0 laporan kas | Belum diimplementasikan: tabel header rekonsiliasi unik per shift dan detail koin. | Saldo awal, hitung fisik dan selisih perlu aturan lebih lanjut; ledger lama tidak dihapus/ditimpa. |
| P1 shift/personel | Tambah `shifts.attendant_user_id` FK nullable dan `shifts.operational_date`; migrasi lama tetap null dengan fallback histori lama. Evaluasi unique partial index satu akun Kasir aktif per outlet setelah duplikasi data diperiksa. | Identitas petugas dan tanggal shift harus terpisah dari akun bersama. Constraint bisa gagal jika data target punya akun/shift konflik; buat preflight dan backfill eksplisit. |
| P1 absensi | Perluas operasi check-in untuk mengaitkan shift yang sesuai; tidak perlu tabel absensi baru. Mungkin perlu indeks jika laporan riwayat bertambah. | Pakai `employee_attendance` yang sudah ada dan relasinya, tanpa membuat tabel duplikat. |
| P1 reset password | Opsional `must_change_password`/`password_changed_at` di `users`, bila dipilih alur password sementara. | Memungkinkan reset admin terpaksa diganti; jangan menyimpan password plaintext/token permanen. |
| P2 produk | Opsional `tracks_stock` di `products`; kategori terkelola hanya bila diperlukan. | Menghindari anggapan stok 0 berarti tidak dilacak; perlu aturan POS ketika flag nonaktif. |
| P2 promo | Tabel `promotions` dan relasi target layanan/produk; relasi/snapshot promo pada transaksi setelah aturan disetujui. | Tidak ada tabel yang cocok saat ini; harus menjaga snapshot transaksi historis. |
| P3 Sheets | Perluas `sync_jobs` (source type, stable event/idempotency key atau record version, error tersanitasi, indeks retry); jangan membuat job table lain sebelum penilaian code/schema. | Tabel ada namun belum memenuhi event outbox/sinkronisasi aktual. |
| P3 foto | Kolom key/path foto pada `users` (nullable). Berkas privat di luar document root, bukan blob yang dapat dieksekusi. | Tidak ada data foto saat ini; perubahan aditif dan opsional. |

Semua migration harus diuji pada snapshot/DB uji, memiliki preflight, tidak menghapus kolom/tabel/data, dan mempunyai prosedur rollback forward-safe. Untuk constraint satu Kasir aktif, jangan memasang sebelum memeriksa duplikasi di setiap outlet.

## 13. Risiko keamanan dan integrasi

- **Pengeluaran/idempotensi:** retry browser/network dapat menggandakan biaya; butuh idempotency key unique dan transaksi DB. Pembelian stok dan biaya harus commit/rollback bersama.
- **Kasir bersama:** akun autentikasi bersama tidak membuktikan siapa petugas fisik. Shift harus menyimpan staf yang ditugaskan dan actor login; kebijakan pemilihan/konfirmasi petugas perlu disetujui.
- **Saldo laci:** pembayaran tunai tersimpan sebagai amount, sementara tender dan kembalian disimpan terpisah. Rekonsiliasi harus mengurangi kembalian dengan benar, memasukkan saldo awal dan hanya biaya yang sumbernya laci.
- **Tanggal periode:** transaksi menggunakan `created_at`; pembayaran menggunakan `paid_at`; pengeluaran memerlukan basis tanggal tersendiri. Menyatukan tanggal ini menggeser pendapatan/penerimaan antarpelaporan.
- **Outlet:** helper Owner memilih outlet aktif pertama. Produk dan beberapa ledger tidak memiliki `outlet_id`. Satu outlet saat ini, tetapi data harus diperiksa sebelum multi-outlet atau scope baru.
- **Hak akses:** endpoint Owner tidak boleh hanya mengandalkan kontrol UI. Validasi outlet, role, CSRF, status aktif, dan kepemilikan resource dilakukan di server.
- **Reset password:** jangan tampilkan password hash, password lama, atau token reset dalam log. Pakai session invalidation/forced change sesuai kebijakan.
- **Upload:** MIME palsu, file polyglot, path traversal, file executable, file terlalu besar, dan akses publik tak sengaja harus dicegah server-side.
- **Google:** credential leak, scope OAuth berlebih, retry duplikat, API quota, dan kegagalan sebagian harus memiliki batas/jejak audit; DB tetap sumber kebenaran.
- **Promo:** perubahan harga atau promo tidak boleh mengubah transaksi yang sudah tersimpan; diskon berlebih/bertumpuk harus ditolak di backend.
- **Laporan:** pengeluaran bukan pengurang pendapatan dan arus kas bersih bukan laba. UI harus memberi label jelas.

## 14. Rencana implementasi bertahap

1. **P0 — Pengeluaran dan keuangan aktual:** kode expense, laporan, audit koreksi, penyimpanan bukti privat, menu Kasir, relasi receipt stok, dan penghapusan periode kuartal diterapkan. Migration sudah aktif pada DB lokal; produksi belum dimigrasikan. Rekonsiliasi kas/koin fisik masih tertunda.
2. **P1 — Karyawan dan identitas shift:** pembuatan/list akun karyawan dengan role absensi saja sudah diimplementasikan tanpa migration. Edit/nonaktif/reset password, riwayat per karyawan, assignment petugas, tanggal operasional, dan reminder masih perlu dikerjakan; migration shift aditif baru setelah preflight dan persetujuan.
3. **P2 — Produk dan promo:** tambah CRUD Owner pada katalog yang dipakai POS, kategori, lifecycle/stok; putuskan stockless handling; definisikan kebijakan promo/membership/malam sebelum menambah migration/checkout logic.
4. **P3 — Google Sheets dan foto profil:** siapkan kredensial/izin dan worker; unggah foto dengan storage privat. Penyederhanaan periode kuartal sudah diterapkan pada P0 tanpa migration.
5. Jangan mengubah backend produksi atau mengaktifkan eksternal sebelum uji staging, backup, dan persetujuan deploy. Tiap tahap harus dapat dirilis terpisah dan menghindari perubahan lintas prioritas yang tidak perlu.

UI periode kuartal tidak memerlukan migration. Filter telah dihapus dari frontend dan nilai `period=quarter` ditolak API supaya semua klien memakai rentang yang didukung saat ini.

## 15. Rencana pengujian

- **Audit/preflight:** pastikan role/outlet/account Kasir aktif yang ada, shift terbuka, FK, unique key, dan nilai lama sebelum setiap migration. Jalankan pada salinan DB uji, bukan produksi.
- **Finance:** cocokkan transaksi lunas vs belum dibayar; pembayaran dengan `paid_at` dan shift penerima; pengeluaran sesuai waktu, metode, sumber; arus kas; periode hari/7 hari/bulan/custom dan zona `Asia/Jakarta`. Pastikan laporan tidak memberi label laba.
- **Double submit/atomik:** dua request idempoten bersamaan; biaya tanpa stok, biaya + beberapa penerimaan stok, stok kurang, kegagalan pada langkah tengah, retry setelah timeout, dan pengembalian error tanpa data setengah tersimpan.
- **Kasir/shift:** hanya satu akun Kasir bersama; buka shift oleh staf yang valid; transaksi/payment/expense tercatat ke sesi benar; reminder satu kali tanpa auto-close; shift sore lintas tengah malam dan tanggal operasional; penutupan menampilkan saldo expected/physical/difference.
- **Karyawan/security:** create role hanya `karyawan`, edit/disable, duplicate username/email, reset password, password hash, invalidasi session pengguna nonaktif, larangan akses API Owner/Kasir untuk karyawan.
- **Produk:** Owner CRUD mempengaruhi katalog Kasir berikutnya; penjualan dan pembelian menggunakan satu ID; stok tidak negatif; pengeluaran pembelian tidak menambah stok dua kali; produk nonaktif tidak dapat dijual.
- **Promo:** tanggal berlaku, eligibility, rounding, maksimal diskon, perubahan harga malam, membership bila kelak ada, promo tumpuk ditolak sesuai aturan yang disetujui; transaksi lama tidak berubah.
- **Google Sheets:** belum dikonfigurasi harus tampil belum terhubung; secret tidak muncul di frontend/log/repository; gagal/retry/idempotensi/quota; sinkron ulang dan status konsisten dengan PostgreSQL.
- **Foto profil:** format sah, MIME palsu, file berukuran besar, nama berbahaya, path traversal, akses lintas pengguna, upload/ganti/hapus, file yatim, file tidak dieksekusi.
- **UI:** responsif Owner/Kasir, light/dark, reduced motion, accessibility/keyboard, notifikasi, dan tidak ada regressi desain Owner terbaru.
- Jalankan `npm.cmd run build`, `php -l` untuk berkas PHP terkait, tes endpoint/DB terarah, serta smoke test role Owner/Kasir/Karyawan. E2E transaksi/expense memakai DB uji.

## 16. Daftar keputusan bisnis yang diperlukan sebelum migrasi/implementasi

1. Periode rolling 7 hari dipertahankan dan diberi label `7 hari terakhir`; minggu kalender tidak digunakan.
2. Kategori awal memakai contoh di permintaan (sabun, pewangi, gas, perawatan mesin, stok lain, operasional lain). Apakah kategori final dan apakah Owner perlu mengelolanya?
3. **Dikonfirmasi:** Tunai→Laci kas dan QRIS→Rekening usaha agar transaksi QRIS tidak mengurangi kas fisik.
4. Koreksi oleh Owner dengan alasan dan audit old/new values dipilih; hard delete tidak disediakan. Kebijakan void/reversal masih belum ditentukan.
5. Bukti wajib dipilih. Implementasi membatasi JPG/PNG/WebP/PDF hingga 5 MB dan menyimpan berkas privat di luar document root; bila ukuran/format perlu diubah, konfirmasi sebelum penerapan.
6. Expense pembelian stok dan penerimaan stok dicatat terpisah tetapi tertaut. Satu expense dapat memiliki beberapa mutasi stok, tiap receipt idempoten.
7. Berapa saldo awal kas laci dan bagaimana setoran/penarikan/pindah kas antarshift dicatat?
8. Tanggal operasional shift malam mengikuti tanggal mulai jadwal dipilih; detail perilaku untuk shift sore yang melewati tengah malam masih perlu dipastikan. Buka/tutup tetap manual.
9. Petugas dipilih saat buka shift dipilih; apakah diperlukan verifikasi PIN personal atau penugasan saat buka shift sudah cukup?
10. Pengingat menjelang akhir jadwal disetujui; implementasi berikutnya mengasumsikan 30 menit sebelum jadwal berakhir dan satu kali per sesi, tanpa auto-close.
11. Reset password: Owner memberi password sementara atau sistem mengirim link/token; apakah akun wajib ganti saat login?
12. Apakah produk nonfisik/nonstok perlu dijual, dan apakah kategori produk boleh ditambah bebas?
13. Aturan promo: nominal/persen, target, batas/kuota, kombinasi dengan harga malam/membership, prioritas, dan rounding.
14. Apakah membership memang akan dibangun dalam ruang lingkup mendatang? Tidak ditemukan implementasinya saat audit.
15. Spreadsheet, tab/kolom, pemilik, akses service account, frekuensi (event/batch), retensi dan role untuk retry.
16. Foto profil: format, batas maksimum byte/dimensi, tempat penyimpanan dan siapa yang boleh melihat.
17. Akses Owner saat ini memilih outlet aktif pertama; apakah akan tetap satu outlet, atau data/user harus dibatasi pada outlet yang dimiliki masing-masing Owner?

## 17. File yang diubah pada implementasi P0 dan tahap berikutnya

### P0 sudah diubah

- `api/public/index.php`: route expense/audit/private receipt, laporan berbasis waktu, shift report dan tautan stok.
- `database/migrations/20261101_001_expense_ledger.sql` dan `database/schema.sql`: ledger aditif; migration diterapkan pada DB lokal saja, bukan produksi.
- `src/shared/api.js`, `src/shared/ExpenseManagement.jsx`, `src/shared/expense-management.css`: form, validasi status, upload bukti, dan dukungan multipart.
- `src/features/cashier/CashierApp.jsx`, `src/features/cashier/data/catalog.js`: navigasi Pengeluaran dan ringkasan penutupan shift.
- `src/features/cashier/components/InventoryManagement.jsx`, `src/features/cashier/components/ShiftReports.jsx`, `src/features/cashier/styles/expense-report.css`, `src/features/cashier/styles/inventory-expense.css`: receipt stok tertaut dan laporan expense per shift.
- `src/features/owner/components/OwnerModule.jsx`, `src/features/owner/components/OwnerDashboard.jsx`: laporan aktual, form/koreksi expense, unduhan CSV, serta penghapusan periode kuartal.
- `docs/OWNER_REVISION_PLAN.md`, `docs/FULL_SYSTEM_INTEGRATION_PLAN.md`, dan `PROGRESS.md`: status implementasi dan blocker migration.

### P1

- `src/features/owner/components/AttendanceAdmin.jsx`, `src/features/owner/styles/employee-management.css`: form/list akun absensi karyawan sudah diimplementasikan.
- `api/public/index.php`: route list/create Owner sudah diimplementasikan; akun dibuat sebagai role `karyawan` dengan `password_hash`.
- `src/features/cashier/CashierApp.jsx` dan komponen shift Kasir untuk assignment petugas masih perlu diubah setelah aturan shift disepakati.
- Migration untuk assignment personel/tanggal operasional/rekonsiliasi serta kemungkinan flag akun masih belum dibuat.

### P2

- `src/features/owner/components/OwnerModule.jsx` atau komponen produk/promo Owner baru.
- `src/features/cashier/CashierApp.jsx`, `src/features/cashier/components/InventoryManagement.jsx` bila perlu katalog/stok; jangan buat katalog terpisah.
- `api/public/index.php`, checkout jika kebijakan promo disetujui, serta migration produk/promo aditif.

### P3

- `src/features/owner/components/OwnerModule.jsx` untuk integrasi dan profil; `OwnerPortal.jsx` hanya jika navigasi perlu.
- Worker/service server baru untuk Google Sheets, storage handler foto, config deployment contoh tanpa credential.
- `api/public/index.php`, migration aman `sync_jobs` dan metadata foto, `database/schema.sql` sebagai dokumentasi schema baru.
- `src/features/owner/components/OwnerDashboard.jsx` dan `src/features/owner/components/OwnerModule.jsx` untuk revisi Google Sheets/foto profil (periode kuartal sudah dihapus pada P0).

### Dokumentasi yang berkaitan

- `docs/FULL_SYSTEM_INTEGRATION_PLAN.md` diperbarui ketika tiap tahap implementasi disetujui dan benar-benar dikerjakan.
- `PROGRESS.md` mencatat status per tahap setelah perubahan, bukan saat rencana saja.

---

## 18. Status implementasi

- Implementasi P0 mencakup front controller PHP dan frontend; tidak ada dependency baru.
- Migration `20261101_001_expense_ledger.sql` diterapkan pada DB lokal `KinoKoinLoundry` setelah persetujuan pengguna. Produksi tidak dimigrasikan.
- Struktur DB lokal lolos uji insert/agregat, audit, unique idempotency, aturan sumber QRIS, dan rollback-only tanpa menyisakan fixture. Sumber dana QRIS dikonfirmasi sebagai rekening usaha. Rekonsiliasi kas/koin fisik belum dibuat.
- P1: pembuatan/list akun karyawan untuk login absensi telah diimplementasikan, tanpa migration. Edit/nonaktif/reset password, riwayat per karyawan, assignment karyawan pada shift, reminder, dan rekonsiliasi masih belum selesai. P2 CRUD produk/promo dan P3 Sheets/foto profil belum diimplementasikan.
- Build frontend dan pemeriksaan sintaks PHP berhasil untuk implementasi expense dan akun karyawan. Pengujian UI browser dan API akun terautentikasi belum selesai pada sesi ini.
