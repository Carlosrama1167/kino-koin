# Audit dan Rancangan Sistem Membership KINO Laundry POS

**Tanggal audit:** 2 November 2026  
**Status:** Implementasi source dan migration tersedia; migration belum diterapkan pada PostgreSQL lokal. Pengujian UI/database terhadap database hasil migration belum dijalankan.

## Ringkasan

Audit awal menemukan belum ada fitur membership. Implementasi sekarang menambahkan endpoint PHP, UI Owner dan Kasir, schema/migration PostgreSQL, idempotensi, dan pengujian aturan murni. PostgreSQL lokal masih memiliki schema sebelum migration baru sehingga fitur belum dapat dipakai sampai migration dijalankan.

Fondasi yang dapat dipakai sudah tersedia: pelanggan, katalog layanan, transaksi dan item transaksi, pembayaran, role Owner/Kasir, transaksi PostgreSQL yang atomik, serta kunci idempotensi checkout. Integrasi perlu ditambahkan secara aditif; data dan relasi transaksi yang ada tidak perlu dihapus atau ditimpa.

Rancangan membership telah disetujui. Checkout Self Service per baris dan validasi Drop Off kini ada di source. Tarif Drop Off Kering telah dikonfirmasi Rp12.000 per 7 kg (atau bagian dari 7 kg), sama siang dan malam, untuk member maupun non-member.

## Ruang lingkup dan cara audit

Audit memeriksa struktur proyek, source React dan PHP, skema serta migration SQL, katalog layanan, dan katalog/relasi database PostgreSQL lokal melalui koneksi konfigurasi aplikasi. File `.env` tidak dibaca atau disalin. Database produksi tidak diakses.

Stack terverifikasi: React 18/JSX + Vite, satu front controller PHP, PDO PostgreSQL, dan PostgreSQL sebagai sumber data utama. Entry point frontend adalah `src/main.jsx` dan `src/app/Root.jsx`; routing API berada di `api/public/index.php`; koneksi dan sesi database dimulai di `api/bootstrap.php`.

## Fitur yang sudah ada dan celah membership

| Area | Kondisi yang diverifikasi | Dampak untuk rancangan |
|---|---|---|
| Pelanggan | Tabel `customers` menyimpan nama dan nomor telepon; indeks telepon tidak unik. Pendaftaran member membuat identitas pelanggan kanonis baru tanpa menggabungkan baris historis. | Lookup member tersedia berdasarkan nama, nomor telepon, atau nomor member. Checkout memakai `transactions.customer_id` ke pelanggan member. |
| Transaksi | `POST /api/transactions` memvalidasi katalog dari server, memakai transaksi database dan `Idempotency-Key`. Checkout aktif dapat lunas atau belum dibayar. | Stempel diinsert dalam transaksi PostgreSQL checkout yang sama setelah item valid tersimpan; sesuai keputusan, transaksi aktif yang belum lunas juga memenuhi syarat. |
| Status batal | Kolom transaksi mendukung `aktif`/`dibatalkan`, tetapi tidak ditemukan alur/API pembatalan transaksi POS pada source yang diaudit. Status batal pada `laundry_orders` adalah status pesanan, bukan pembatalan transaksi checkout. | Stempel hanya untuk transaksi aktif yang memenuhi syarat. Jika pembatalan transaksi ditambahkan kemudian, pembatalan dan koreksi stempel harus dirancang sebagai operasi audit yang aman. |
| Layanan Self Service | Katalog memuat Cuci, Kering, Cuci + Kering, Extra Spin, dan Extra Dry. Checkout menerima berat per baris, kombinasi beberapa jenis layanan, dan menyimpan mesin per item. | Helper API menghitung `ceil(weight_kg/7)` per baris. Stempel otomatis terhubung ke checkout; unique constraint membatasi satu stempel per member/tanggal. |
| Layanan Drop Off | Migration menambahkan `DROP-KERING` dengan tarif Rp12.000 per 7 kg atau bagian darinya; tarif malam sama. | Backend dan frontend membatasi pilihan ke Cuci + Kering, Kering, Kering + Lipat, Kering + Setrika, Lipat saja, atau Setrika saja. Cuci saja dan pencampuran dengan Self Service ditolak. |
| Owner | Portal Owner memiliki halaman membership untuk anggota, verifikasi, transaksi Self Service, kartu, penyerahan, dan rekap undian. Dashboard Owner juga menampilkan jumlah member aktif, kartu penuh, dan kupon. | Endpoint pembacaan/ubah data Owner memeriksa role Owner. Kupon hanya dibuat saat kartu diserahkan; tidak ada pemilihan pemenang otomatis. |
| Kasir | POS memiliki pencarian/pemilihan member, pendaftaran, verifikasi pelajar, progres/stempel harian, dan penyerahan kartu penuh. | Kasir dapat menjalankan verifikasi dan penyerahan kartu diizinkan backend; harga member tetap mengikuti katalog. |
| Harga | Backend menetapkan harga dari katalog layanan server. POS memiliki input diskon nominal yang sudah ada dan tidak terkait membership. | Membership tidak mengubah tarif dan tidak menambahkan diskon otomatis. |
| Google Sheets | `sync_jobs` tersedia pada schema, tetapi tidak ditemukan worker/route sinkronisasi Google Sheets aktif pada source yang diaudit. | Jangan menjadikan Sheets sumber data membership; integrasi membership ke Sheets hanya sebagai salinan laporan bila integrasi satu arah tersebut dibangun dan disetujui. |
| Pengujian | Tidak ada test runner pada `package.json`. `api/tests/membership_rules_test.php` menguji aturan mesin Self Service, tarif Kering, kombinasi Drop Off, dan keputusan pemberian stempel. | PHP lint, unit rule test, dan production build telah dijalankan. Uji konkurensi/rollback dan UI terhadap PostgreSQL hasil migration masih perlu dilakukan sebelum operasional. |

### Integrasi dan otorisasi yang sudah tersedia

- Session PHP memakai `password_hash`/`password_verify`, cookie HttpOnly/SameSite, pemeriksaan CSRF, dan helper `require_user()` di `api/bootstrap.php`.
- Checkout mengunci shift dan stok terkait, mengembalikan hasil idempotensi untuk submit ulang, lalu commit transaksi hanya setelah semua bagian sukses.
- Checkout menyimpan berat dan jumlah mesin per baris Self Service di `transaction_items`, serta jumlah agregat pada `transactions`. Database existing harus menjalankan migration baru sebelum memakai endpoint yang diperbarui.
- Jenis layanan disimpan pada `services.category`; item transaksi menyimpan FK ke `services` atau `products`. Transaksi mengacu ke pelanggan, kasir, outlet, dan shift.
- Role yang ada adalah `owner`, `kasir`, dan `karyawan`. Menu frontend bukan kontrol otorisasi; semua endpoint membership harus memeriksa role di backend.
- Seed dan database lokal sama-sama menunjukkan katalog Drop Off tanpa layanan Cuci saja. Ini tidak menggantikan validasi backend karena isi katalog bisa berubah.

## Skema dan relasi PostgreSQL

Pada audit awal, PostgreSQL lokal memuat tabel inti `customers`, `services`, `transactions`, `transaction_items`, `payments`, `laundry_orders`, `users`, `outlets`, dan `shifts`, beserta tabel inventory, expense, attendance, dan sync; tabel membership belum ada. Migration baru di bawah sudah ada di repository tetapi **belum diterapkan** pada database lokal.

Relasi transaksi yang relevan:

```text
transactions.customer_id  -> customers.id
transactions.cashier_id   -> users.id
transactions.outlet_id    -> outlets.id
transactions.shift_id     -> shifts.id
transaction_items.transaction_id -> transactions.id
transaction_items.service_id     -> services.id
transaction_items.product_id     -> products.id
payments.transaction_id          -> transactions.id
```

Nomor telepon pelanggan tidak unik; pencarian harus mengakomodasi beberapa hasil dengan nomor yang sama. Implementasi tidak menambah FK member langsung ke `transactions`: member ditautkan melalui `membership_members.customer_id` dan `transactions.customer_id`.

Schema/migration yang diperiksa:

- `database/schema.sql`
- `database/migrations/20261031_001_integrated_checkout.sql`
- `database/migrations/20261031_002_attendance_safeguards.sql`
- `database/migrations/20261101_001_expense_ledger.sql`
- `database/migrations/20261102_001_self_service_line_weights.sql`
- `database/migrations/20261102_002_membership_and_dropoff_dry.sql`

Hasil inspeksi database di atas adalah snapshot sebelum migration 20261102 dijalankan; pemeriksaan hanya mengambil metadata tabel/constraint dan kode layanan, bukan data identitas pelanggan.

## Perubahan database dalam source

1. **`membership_types`** — konfigurasi jenis, warna kartu, jumlah slot fisik (12 Reguler, 6 Pelajar/Mahasiswa), dan kewajiban verifikasi.
2. **`membership_members`** — nomor member unik, FK unik ke pelanggan kanonis, status dan verifikasi, pencatat, serta kunci/hash idempotensi pendaftaran. Pendaftaran tidak mengubah pelanggan historis.
3. **`membership_cards`** — nomor unik, member, snapshot jumlah slot, status aktif/diserahkan, petugas serta waktu terbit/serah. Partial unique index membatasi satu kartu aktif per member.
4. **`membership_stamps`** — FK ke member, kartu yang cocok dengan member, transaksi, tanggal operasional Jakarta, dan petugas. `UNIQUE(member_id, operating_date)` dan `UNIQUE(transaction_id)` mencegah duplikasi.
5. **`membership_raffle_coupons`** — nomor kupon unik dan maksimal satu kupon per kartu.
6. **`membership_card_redemptions`** — hubungan unik kartu lama, kupon, kartu baru, petugas, dan kunci/hash idempotensi; menyimpan bukti serah-terima dan penerbitan dalam satu histori.
7. **Rincian transaksi** — berat dan washer/dryer per item Self Service pada `transaction_items`; transaksi menyimpan agregat. Migration Drop Off menambah `DROP-KERING` Rp12.000 per 7 kg atau bagian darinya tanpa tarif malam khusus.
8. **Relasi transaksi-member** — checkout menautkan melalui `transactions.customer_id` ke pelanggan yang terhubung dengan member. Tidak ada perubahan pada transaksi historis atau stempel retrospektif.

FK membership mencegah penghapusan riwayat. Status nonaktif/penyerahan dicatat sebagai perubahan status, bukan hard delete. Kedua migration bersifat aditif dan tidak dijalankan otomatis oleh aplikasi.

### Integritas dan konkurensi

- Checkout mengunci baris member lalu kartu aktif sebelum memeriksa tanggal operasional; unique constraint harian menjadi perlindungan terakhir terhadap checkout paralel.
- Checkout menyimpan transaksi, item, dan stempel dalam transaksi database yang sama. Jika checkout gagal/rollback, stempel juga rollback.
- Penyerahan kartu mengunci member dan kartu, memeriksa progres penuh dan status aktif, lalu mengubah status kartu lama, membuat satu kupon, kartu pengganti, dan catatan redemption dalam satu transaksi.
- Kunci idempotensi checkout tetap memakai mekanisme saat ini. Pendaftaran dan redemption kartu juga memakai kunci idempotensi.
- Status penuh dihitung dari jumlah stempel dibanding snapshot konfigurasi kartu; kartu yang sudah diserahkan tidak dapat menerima stempel lagi.

## Alur membership yang diimplementasikan

### Registrasi dan verifikasi

1. Owner atau Kasir mendaftarkan member Reguler atau Pelajar/Mahasiswa; sistem membuat pelanggan kanonis baru tanpa mengubah pelanggan historis.
2. Member Reguler dapat aktif setelah pendaftaran. Kasir boleh memeriksa bukti Pelajar/Mahasiswa secara langsung dan mengesahkan saat pendaftaran; Owner juga boleh meninjau atau mengesahkan.
3. Setelah aktif, sistem menerbitkan kartu unik dengan jumlah slot dari konfigurasi jenis membership. Status, waktu, dan petugas verifikasi dicatat; sistem tidak menyimpan unggahan dokumen identitas.

### Checkout dan pemberian stempel

1. Kasir mencari member berdasarkan nama, nomor telepon, atau nomor member dan memilih identitas yang benar.
2. Frontend menampilkan tipe, status verifikasi, progres kartu, dan status sudah/belum memperoleh stempel pada tanggal operasional.
3. Setiap baris Self Service utama memiliki kolom berat sendiri. Kasir boleh menambahkan Cuci saja, Kering saja, dan Cuci + Kering dalam satu transaksi. Mesin dan harga siklus dihitung per baris; berat gabungan tidak menentukan jumlah mesin.
4. Self Service tidak dicampur dengan Drop Off. Backend memvalidasi kombinasi layanan dan berat dari request, tidak hanya mengandalkan UI.
5. Checkout mengirim `membership_member_id`; backend memvalidasi member aktif/terverifikasi, mengikat pelanggan kanonis, serta memvalidasi item dan aturan layanan dari database. Member tidak mengubah harga.
6. Setelah transaksi Self Service berstatus aktif dan item tersimpan, backend mencoba memberikan satu stempel untuk tanggal `Asia/Jakarta`. Jumlah baris, berat, mesin, dan jenis layanan tidak menambah jumlah stempel. Constraint unik membuat transaksi kedua hari itu tidak menambah stempel.
7. Transaksi Drop Off saja tidak menghasilkan stempel. Drop Off dan Self Service pada hari yang sama tetap memperoleh satu stempel melalui transaksi Self Service yang terpisah.

### Penyerahan kartu dan kupon

1. Sistem menampilkan kartu penuh berdasarkan progres dan snapshot jumlah kolom.
2. Petugas berwenang mencatat penyerahan kartu fisik. Backend menolak kartu belum penuh, sudah diserahkan, atau permintaan duplikat.
3. Dalam satu transaksi database, sistem mengunci member dan kartu lama, menandai penyerahan, menghasilkan tepat satu nomor kupon unik, dan menerbitkan kartu baru kosong dengan nomor unik.
4. Owner melihat riwayat kartu dan daftar kupon, lalu dapat mengunduh daftar peserta dalam CSV. Pengundian pemenang tidak dilakukan otomatis.

### Integrasi UI/API

- Kasir: `/api/membership/types`, `/api/membership/members`, pendaftaran/verifikasi, penyerahan kartu, dan `POST /api/transactions`.
- Owner: daftar/ubah/nonaktifkan member, riwayat Self Service, kartu, penyerahan, serta daftar/ekspor kupon melalui `/api/owner/membership/*`.
- API memeriksa role Owner/Kasir di backend; batas outlet tidak diterapkan ke membership karena rancangan POS yang ada memakai satu outlet aktif.
- Pelaporan membership mengambil data PostgreSQL. Jika sinkronisasi Google Sheets dibuat di kemudian hari, kirim ringkasan/ekspor satu arah saja.

## Pengujian penerimaan

Kriteria penerimaan sebelum rilis:

1. Transaksi Self Service pertama pada tanggal operasional memberi satu stempel; transaksi berikutnya hari itu tidak menambah stempel.
2. Berat tiap baris tidak digabung untuk hitungan mesin; baris 5 kg + 10 kg masing-masing memakai `ceil(berat/7)`.
3. Cuci saja 5 kg menghasilkan 1 washer; Kering saja 5 kg menghasilkan 1 dryer; Cuci + Kering 10 kg menghasilkan 2 washer dan 2 dryer.
4. Campuran Cuci 5 kg + Cuci + Kering 5 kg + Kering 5 kg menghasilkan 1 washer pada baris Cuci, 1 washer+dryer pada Cuci + Kering, serta 1 dryer pada baris Kering.
5. Transaksi dapat menggabungkan ketiga layanan Self Service; satu member tetap mendapat maksimal satu stempel per tanggal, apa pun jumlah baris/berat/mesinnya.
6. Berat 15 kg tetap satu stempel.
7. Transaksi Self Service dan Drop Off pada hari yang sama memberi satu stempel hanya dari Self Service, dan jenis layanan tersebut tidak dicampur dalam satu transaksi.
8. Transaksi Drop Off dan Setrika Saja tidak memberi stempel; Cuci saja Drop Off ditolak backend dan frontend. Kombinasi Drop Off yang diizinkan perlu diuji. Kering saja ditagih Rp12.000 per 7 kg atau bagian dari 7 kg, tanpa tarif malam berbeda.
9. Checkout gagal/rollback atau transaksi yang dibatalkan tidak menghasilkan stempel; dua checkout paralel untuk member yang sama pada hari yang sama hanya menghasilkan satu stempel.
10. Kartu penuh hanya dapat diserahkan satu kali, menghasilkan satu kupon; kartu baru hanya terbit setelah penyerahan dan kartu lama tidak dapat dipakai ulang.
11. Member Reguler dan Pelajar terverifikasi mendapat aturan stempel yang sama; verifikasi Pelajar dilakukan Kasir di tempat dan Owner dapat meninjau/mengesahkan.
12. Role yang tidak berwenang tidak dapat membuat/verifikasi member, menyerahkan kartu, menerbitkan kartu, atau melihat rekap Owner melalui pemanggilan API langsung.
13. Harga member dan non-member tetap sama; checkout retry tidak menggandakan transaksi, stempel, kupon, atau kartu.
14. Progres kartu mengikuti konfigurasi fisik: 12 stempel untuk Reguler dan 6 untuk Pelajar/Mahasiswa.

Validasi yang telah dijalankan: `php -l` untuk endpoint/helper/test, `php api/tests/membership_rules_test.php` untuk hitungan washer/dryer per baris, kombinasi layanan, tarif Kering per 7 kg, dan keputusan stamp, serta `npm run build`. Pengujian database (unique constraint, paralel checkout, rollback, serah-terima/kupon), otorisasi HTTP, dan UI end-to-end belum dijalankan; lakukan terhadap database disposable setelah migration, sebelum rilis. Tidak ada migration yang dijalankan pada PostgreSQL lokal.

## Keputusan yang telah dikonfirmasi

1. Jumlah slot kartu fisik berbeda per jenis: **Reguler 12** dan **Pelajar/Mahasiswa 6**. Nilai tersimpan pada konfigurasi jenis dan snapshot pada setiap kartu yang diterbitkan.
2. Stempel diberikan saat transaksi Self Service berstatus aktif berhasil disimpan, termasuk jika status pembayarannya belum lunas.
3. Owner dan Kasir boleh mencatat penyerahan kartu penuh serta menerbitkan kartu baru. Pemeriksaan dilakukan server-side dan transaksi penyerahan/kupon/kartu baru tetap atomik.
4. Kasir boleh memeriksa bukti Pelajar/Mahasiswa secara langsung dan mengesahkan saat pendaftaran; Owner juga boleh meninjau/mengesahkan. Bukti dicatat sebagai verifikasi petugas, bukan unggahan dokumen.
5. Stempel hanya berasal dari Self Service. Tiga layanan utama Self Service boleh digabungkan dalam satu transaksi dengan berat per baris; Drop Off tidak boleh dicampur dengan Self Service dan tidak menghasilkan stempel.
6. Harga member sama dengan non-member dan tidak ada diskon/benefit harga khusus membership. Nominal Rp15.000/Rp10.000 yang disebut sebelumnya tidak dipakai karena pengguna mengonfirmasi aturan harga awal tetap berlaku.
7. Kombinasi Drop Off yang disetujui: Cuci + Kering; Kering saja; Kering + Lipat; Kering + Setrika; Lipat saja; Setrika saja. Cuci saja tetap dilarang.
8. Pengguna menyetujui rancangan untuk dilanjutkan; tarif Drop Off Kering kemudian dikonfirmasi sebagai Rp12.000 per 7 kg atau bagian dari 7 kg, sama untuk siang dan malam.

## Tarif Drop Off Kering yang telah dikonfirmasi

- **Kering saja:** Rp12.000 per 7 kg atau bagian dari 7 kg, sama untuk siang dan malam serta untuk member/non-member.
- Harga katalog komponen Lipat dan Setrika yang sudah ada tetap Rp1.500/kg, Rp4.000/kg (reguler), dan Rp6.000/kg (express), kecuali Owner mengubah tarif layanan melalui pengelolaan harga yang sudah tersedia.

## Referensi source

- [Root dan pemilihan role](../src/app/Root.jsx)
- [Portal Owner](../src/features/owner/components/OwnerPortal.jsx)
- [Manajemen membership Owner](../src/features/owner/components/OwnerMembership.jsx)
- [Aplikasi Kasir dan checkout](../src/features/cashier/CashierApp.jsx)
- [Pencarian dan pemilihan member Kasir](../src/features/cashier/components/MembershipPicker.jsx)
- [Helper API frontend](../src/shared/api.js)
- [Front controller PHP](../api/public/index.php)
- [Aturan kalkulasi dan seleksi layanan](../api/membership_rules.php)
- [Pengujian aturan membership/layanan](../api/tests/membership_rules_test.php)
- [Bootstrap dan autentikasi backend](../api/bootstrap.php)
- [Schema PostgreSQL](../database/schema.sql)
- [Seed katalog layanan](../database/seed.sql)
- [Migration membership dan Drop Off Kering](../database/migrations/20261102_002_membership_and_dropoff_dry.sql)
