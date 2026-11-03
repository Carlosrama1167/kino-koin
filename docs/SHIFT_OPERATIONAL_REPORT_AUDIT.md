# Audit Laporan Shift dan Operasional KINO Laundry POS

Tanggal audit: 3 November 2026  
Status: audit source code dan berkas schema; belum ada perubahan aplikasi atau database.

## Ringkasan

Laporan Shift Kasir sudah membaca sesi, transaksi, pembayaran, pengeluaran, dan mutasi koin dari PostgreSQL. Ringkasan setelah tutup shift juga dapat dicetak atau dibagikan. Namun, fitur itu belum merupakan laporan operasional harian yang diminta: belum ada halaman rekap Owner lintas shift, rekonsiliasi fisik kas/koin, input dan verifikasi LG, data pekerjaan karyawan, setrika, sepatu/karpet, atau checklist mesin.

Audit ini berdasarkan source dan schema repository. Tidak ada koneksi atau pemeriksaan langsung ke database berjalan; penerapan migration dan isi data produksi belum dapat dipastikan. Tidak ada tabel, migration, endpoint, atau business logic yang diubah. Implementasi menunggu persetujuan rancangan dan jawaban atas keputusan operasional pada bagian akhir.

## Halaman dan Fitur Laporan yang Ada

| Halaman/alur | Implementasi yang terverifikasi | Batas saat ini |
|---|---|---|
| Laporan Shift Kasir | [ShiftReports.jsx](../src/features/cashier/components/ShiftReports.jsx) memanggil `GET /api/shifts/reports`; API membaca PostgreSQL. Ada filter tanggal buka dan tipe shift serta rincian sesi. | Hanya bisa dibuka role Kasir; API mengembalikan seluruh sesi pada outlet, bukan membatasi ke sesi milik Kasir yang login. Tombol cetak di halaman ini hanya menampilkan pemberitahuan bahwa cetak belum dikonfigurasi. |
| Ringkasan tutup shift | [CashierApp.jsx](../src/features/cashier/CashierApp.jsx) menutup sesi lewat `POST /api/shifts/close`, menampilkan pembayaran, pengeluaran, arus tunai, transaksi belum lunas, dan mutasi koin. Tersedia cetak browser/PDF dan bagikan melalui Web Share atau tautan WhatsApp. | Tidak meminta kas fisik/koin fisik, catatan penutupan, atau verifikasi Owner. Ini ringkasan ledger, bukan rekonsiliasi. |
| Laporan Keuangan Owner | [OwnerModule.jsx](../src/features/owner/components/OwnerModule.jsx) memanggil `GET /api/owner/finance`; ada filter periode/metode/status/kategori, daftar transaksi dan pengeluaran, ekspor CSV, koreksi pengeluaran dengan alasan, dan audit koreksi. | Bukan laporan per shift atau laporan operasional harian; baris yang dikembalikan dibatasi 200. Belum ada cetak PDF atau laporan WhatsApp di halaman ini. |
| Dashboard Owner | [OwnerDashboard.jsx](../src/features/owner/components/OwnerDashboard.jsx) menampilkan ringkasan bisnis dari endpoint Owner. | Tidak menggabungkan rekap operasional per shift yang diminta. |

`src/features/cashier/data/shiftReports.js` berisi contoh statis, tetapi `ShiftReports.jsx` tidak mengimpornya. Jadi sumber angka laporan shift saat ini bukan file mock tersebut. README dan beberapa dokumen fitur masih menyatakan laporan, koin, atau pengeluaran menggunakan mock/belum tersedia; pernyataan itu tidak lagi sesuai dengan jalur source yang ditemukan dalam audit ini.

## Alur Shift dan Sumber Data

1. Kasir membuka sesi lewat `POST /api/shifts/open`. Server menyimpan `user_id`, `outlet_id`, `shift_type`, `started_at`, dan status. Jenis yang diterima: `pagi`, `siang`, `sore`, `malam`.
2. Checkout menyimpan transaksi dan pembayaran ke sesi aktif. `transactions.shift_id` menandai shift transaksi dibuat; `payments.shift_id` menandai shift pembayaran diterima.
3. Pengeluaran dapat dikaitkan ke shift aktif, menyimpan sumber dana (laci kas/rekening usaha), petugas, bukti, dan audit koreksi Owner. Endpoint mengembalikan status ketersediaan ledger berdasarkan keberadaan tabel; migration pengeluaran belum tentu diterapkan pada database berjalan.
4. Mutasi koin manual memerlukan shift terbuka dan menyimpan jenis koin, arah, jumlah, petugas, alasan, waktu, dan `shift_id`. Pengurangan koin dari layanan self-service otomatis juga dibuat saat transaksi.
5. Kasir menutup sesi lewat `POST /api/shifts/close`. API menghitung ringkasan dari ledger terkait, mengisi `ended_at`, dan menandai sesi ditutup. Tidak ada snapshot atau nilai kas/koin fisik yang direkonsiliasi.

Query laporan shift mengelompokkan transaksi menurut `transactions.shift_id`, pembayaran diterima menurut `payments.shift_id`, pengeluaran menurut `expenses.shift_id`, dan mutasi menurut `coin_movements.shift_id`. Dengan demikian pembayaran yang diterima di shift berbeda dari shift transaksi tidak dipindahkan ke omzet tunai shift asal. Transaksi belum lunas dilaporkan sebagai tagihan, bukan pembayaran diterima.

Dasar tanggal laporan sekarang adalah tanggal lokal Asia/Jakarta pada `shifts.started_at` (`date_basis: shift_started_at`). Tidak ada `operational_date` di tabel shift. Sesi yang melewati tengah malam tetap difilter menurut tanggal mulai sesi. Konfigurasi jadwal saat ini menetapkan pagi 06:00–12:00, siang 13:00–18:00, sore 19:00–00:00, dan malam 01:00–06:00; label/jadwal ini perlu dikonfirmasi sebelum dipakai sebagai aturan laporan harian.

## Inventaris Sumber Data

| Data laporan | Sumber yang sudah ada | Status dan batas |
|---|---|---|
| Sesi, kasir, waktu mulai/selesai, status | `shifts`, `users` | Tersedia. Belum ada tanggal operasional eksplisit atau catatan penutupan. |
| Jumlah/nilai transaksi dan belum lunas | `transactions`, terhubung melalui `shift_id` | Tersedia. Schema menyimpan `subtotal`, `discount_amount`, `delivery_fee`, `total`, dan status, tetapi laporan shift belum menampilkan rincian omzet kotor/diskon/net secara eksplisit. |
| Tunai, QRIS, jumlah pembayaran | `payments` | Tersedia dan dikelompokkan menurut `payments.shift_id` serta metode. Pembayaran QRIS dicatat manual; tidak ditemukan verifikasi gateway eksternal. |
| Pengeluaran dan arus kas | `expenses`, `expense_audit`, endpoint `/api/expenses*`, laporan Owner dan tutup shift | Sudah diimplementasikan kondisional terhadap migration. Pengeluaran laci kas dipisahkan dari rekening usaha. Tidak boleh dikurangkan dari omzet. Status migration pada database target belum diverifikasi. |
| Mutasi dan saldo koin | `coin_types`, `coin_movements`; API `/api/coins*` | Saldo stok global dan mutasi berpetugas tersedia. Mutasi terhubung ke shift. Tidak tersedia saldo fisik awal/akhir per jenis koin per shift atau rekonsiliasi selisih. Query laporan mengenali nama `Koin Reguler` dan `Koin Extra Dry`; pemetaan terhadap istilah permintaan “Koin Besar” dan “Koin Extra” perlu dikonfirmasi. |
| Jumlah washer dari POS | `transactions.washer_machine_count`, `transaction_items.washer_machine_count`; data item Self Service | Data penggunaan POS dapat direkam, tetapi endpoint laporan shift tidak menyajikan rekap load washer. Tidak ditemukan integrasi API LG. |
| Cash operasional | Tidak ditemukan ledger terpisah | Tidak boleh disimpulkan dari omzet, pembayaran, atau pengeluaran. Perlu definisi dan sumber input tersendiri. |
| Drop Off per karyawan | `transactions`, `laundry_orders` menyimpan transaksi/order, berat/status umum | Tidak ditemukan assignment karyawan, load per pekerja, atau ledger pekerjaan untuk payroll; endpoint Drop Off yang ada bukan laporan beban kerja per karyawan. |
| Sepatu/karpet dan setrika | Katalog transaksi dapat menyimpan layanan/item dan berat transaksi | Tidak ada entitas pekerjaan dengan kategori/penanggung jawab/status yang mendukung rekap yang diminta. Tidak ditemukan tabel/fitur payroll. |
| Checklist karet washer/jendela dryer | Tidak ditemukan tabel atau endpoint | Belum tersedia; status belum diperiksa tidak boleh diasumsikan selesai. |
| Integrasi Google Sheets | `sync_jobs` tersedia sebagai struktur | Tidak ditemukan worker/endpoint sinkronisasi laporan aktif; UI Owner menampilkan status integrasi. Jangan menyebut sinkronisasi sudah berjalan. |

### Schema yang Ditinjau

Schema memuat `users`, `shifts`, `shift_schedules`, `employee_attendance`, `transactions`, `transaction_items`, `payments`, `laundry_orders`, `coin_types`, `coin_movements`, `expenses`, dan `expense_audit`, beserta tabel lain untuk transaksi, katalog, membership, dan inventory. Tidak ditemukan tabel `operational_date`, laporan operasional, payroll/pekerjaan karyawan, load LG, cash operasional, pekerjaan sepatu/karpet/setrika, atau checklist mesin.

Migration [20261101_001_expense_ledger.sql](../database/migrations/20261101_001_expense_ledger.sql) menambahkan ledger pengeluaran dan audit koreksi. Karena API memeriksa ketersediaan tabel saat runtime, audit repository tidak cukup untuk menyimpulkan bahwa migration itu sudah diterapkan pada PostgreSQL produksi/lokal.

## Hak Akses Saat Ini

- `GET /api/shifts/reports`, pembukaan/penutupan shift, dan endpoint POS mensyaratkan role `kasir`. Laporan shift menyeleksi semua sesi pada `outlet_id` Kasir tanpa filter `user_id`; pembatasan ke shift sendiri belum diterapkan.
- `GET /api/owner/finance` mensyaratkan role Owner. Laporan Shift tidak memiliki endpoint Owner khusus untuk melihat seluruh shift atau rekap tanggal.
- API mutasi koin mengizinkan Owner dan Kasir, tetapi menautkan mutasi ke shift terbuka milik pengguna.
- Data absensi Karyawan tersedia, tetapi bukan pencatatan pekerjaan. Belum ditemukan API untuk Karyawan memasukkan load kerja atau melihat status verifikasinya.
- Akses route diperiksa di backend; penyembunyian menu frontend saja tidak cukup untuk memenuhi batas role baru.

## Fitur Berjalan, Belum Tersedia, dan Data Contoh

**Berjalan dari database:** transaksi, pembayaran, sesi shift, laporan pembayaran shift, mutasi koin, pengeluaran jika migration tersedia, laporan keuangan Owner, audit koreksi pengeluaran, transaksi item yang menyimpan berat/jumlah mesin, dan ringkasan tutup shift.

**Belum tersedia:** tiga tab laporan yang diminta sebagai satu modul; laporan Owner harian lintas shift; rekonsiliasi fisik; input/status verifikasi operasional; cash operasional terpisah; pekerjaan per karyawan termasuk Drop Off, sepatu/karpet, setrika dan kait payroll; checklist per mesin; cetak dari halaman laporan shift; cetak laporan harian; dan pengingat/peringatan selisih total per shift.

**Data contoh/prototipe yang berdekatan:** `shiftReports.js` memuat contoh visual tetapi tidak dipakai `ShiftReports.jsx`. Beberapa halaman Kasir lain menggunakan data contoh/state lokal; audit ini tidak menganggapnya sebagai sumber laporan baru. Tidak ditemukan angka contoh pada query laporan shift yang aktif.

## Rancangan Alur yang Disarankan

1. Untuk transaksi, pembayaran, shift, pengeluaran, serta mutasi koin, laporan mengambil data langsung dari ledger yang sudah ada. UI tidak meminta input ulang dan omzet, pembayaran diterima, pengeluaran, serta arus kas tetap menjadi ukuran berbeda.
2. Untuk data yang belum ada otomatis, petugas yang berwenang membuat entri operasional dengan tanggal operasional, shift/sesi, petugas, waktu input, sumber data, nilai desimal bila relevan, catatan, dan status verifikasi. Status belum diisi harus berbeda dari nilai nol.
3. Owner memeriksa dan memverifikasi data. Koreksi menyimpan alasan, nilai sebelum/sesudah, identitas, dan waktu; jangan menimpa atau mengoreksi ledger transaksi sumber melalui laporan.
4. Laporan harian menggabungkan shift yang ditetapkan untuk tanggal operasional. Bila total harian tidak sama dengan jumlah shift, tampilkan selisih/peringatan dan minta verifikasi; jangan menyesuaikan angka sumber secara otomatis.
5. Cetak/PDF dan WhatsApp menggunakan model data hasil filter yang sama dengan layar, serta menampilkan data yang belum tersedia sebagai belum tersedia, bukan nol.

## Perubahan Database yang Mungkin Diperlukan

Belum ada migration yang dibuat atau dijalankan. Setelah definisi operasional disetujui, kemungkinan diperlukan:

- Identitas tanggal operasional dan aturan penautan shift lintas tengah malam, tanpa mengubah tanggal transaksi historis secara otomatis.
- Entitas laporan/rekap per outlet, tanggal operasional, dan shift untuk status pengisian/verifikasi dan catatan.
- Tabel input bertipe untuk data yang memang belum ada: hasil washer dari LG/manual, hitung fisik awal/akhir koin bila dipilih, cash operasional, pekerjaan manual, serta checklist mesin.
- Relasi pekerjaan ke `users`, dan bila dapat dipastikan tanpa duplikasi, relasi opsional ke transaksi/order/item sumber. Kuantitas harus mendukung pecahan untuk load/kg. Integrasi payroll harus menggunakan aturan payroll yang telah disetujui dan tidak mengubah tarif.
- Identitas input, verifikasi, koreksi, timestamp, dan audit trail dengan FK/constraint/idempotensi yang sesuai.
- Indeks unik untuk mencegah entri ganda hanya setelah grain data (per shift, karyawan, kategori, order, dan item checklist) ditentukan.

Sebelum rancangan tabel final, perlu dipastikan apakah angka washer dari POS merupakan jumlah mesin atau jumlah load; bagaimana mencegah duplikasi saat pekerjaan sudah tercatat di POS; dan apakah saldo koin fisik dicatat sebagai snapshot atau hasil hitung yang menghasilkan mutasi penyesuaian. Tabel input tidak boleh menduplikasi sumber yang sudah tersedia.

## Keputusan Operasional yang Memerlukan Konfirmasi

1. Apakah “Malam” yang tersimpan di sistem sama dengan “Malam/Midnight”, atau keduanya shift berbeda? Jadwal saat ini hanya memiliki empat tipe, dan tipe `malam` dijadwalkan 01:00–06:00; jangan gabungkan atau ubah label tanpa persetujuan.
2. Apa tanggal operasional untuk shift yang melintasi tengah malam: tanggal mulai, tanggal selesai, atau kalender bisnis lain? Apakah jadwal 19:00–00:00 dan 01:00–06:00 masih berlaku?
3. Apakah “Koin Besar/Extra” sama dengan tipe database “Koin Reguler/Extra Dry”? Mohon tetapkan nama tampilan dan pemetaan.
4. Apa definisi omzet kotor, diskon, omzet bersih, dan “pembayaran diterima” yang digunakan KINO? Apakah ringkasan pendapatan Owner sekarang (`transactions.total` transaksi lunas) menjadi definisi resmi, atau perlu definisi akuntansi lain?
5. Apa yang termasuk cash operasional, siapa yang boleh input, dan apakah nilainya sumber kas terpisah dari transaksi/pengeluaran?
6. Untuk angka washer, apakah POS menjadi sumber utama dan LG menjadi verifikasi manual, atau LG menjadi input utama? Siapa Owner yang memverifikasi dan apa status ketika verifikasi ditolak?
7. Apa satuan/aturan Drop Off: load pecahan per order atau pekerjaan? Bagaimana daftar karyawan yang harus ditampilkan, termasuk karyawan tanpa akun aplikasi?
8. Apakah pekerjaan setrika/sepatu/karpet yang sudah berupa item transaksi cukup sebagai sumber, atau petugas tetap harus mengalokasikan pekerjaan kepada karyawan? Persetujuan diperlukan sebelum pengaruh ke payroll.
9. Apa daftar item checklist tetap per shift, dan apakah “AllFilter” item terpisah atau pemeriksaan gabungan?
10. Apakah Kasir boleh melihat seluruh laporan outlet atau hanya shift sendiri? Brief menyebut shift sendiri; perilaku API saat ini memberi akses ke semua sesi outlet.

## Pemeriksaan dan Langkah Berikutnya

- Pemeriksaan dilakukan pada halaman React, endpoint PHP, schema, migration pengeluaran, dan dokumentasi terkait; tidak ada data produksi atau database live yang dibaca.
- Belum ada automated test laporan shift/operasional. `package.json` hanya mendefinisikan `dev`, `build`, dan `preview`; test PHP yang ditemukan berfokus pada aturan membership.
- Beberapa dokumentasi lama bertentangan dengan kode saat ini, terutama status ledger pengeluaran, koin, dan laporan shift. Pembaruan dokumentasi implementasi/test harus mengikuti implementasi yang disetujui, bukan asumsi dari dokumen lama.
- Langkah berikutnya: minta persetujuan rancangan dan jawaban keputusan operasional; setelah itu audit koneksi/database target dan status migration, lalu siapkan dokumen implementasi serta testing sebelum migration dan perubahan kode.

## Referensi Source

- [ShiftReports.jsx](../src/features/cashier/components/ShiftReports.jsx)
- [CashierApp.jsx](../src/features/cashier/CashierApp.jsx)
- [CoinManagement.jsx](../src/features/cashier/components/CoinManagement.jsx)
- [OwnerModule.jsx](../src/features/owner/components/OwnerModule.jsx)
- [api/public/index.php](../api/public/index.php)
- [database/schema.sql](../database/schema.sql)
- [20261101_001_expense_ledger.sql](../database/migrations/20261101_001_expense_ledger.sql)
- [architecture-and-flows.md](./architecture-and-flows.md)
- [FEATURE_MAP.md](./FEATURE_MAP.md)
- [README-backend.md](../README-backend.md)