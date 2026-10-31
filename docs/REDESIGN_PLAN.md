# Rencana Redesign KINO Laundry POS

Dokumen ini adalah rencana untuk ditinjau sebelum implementasi. **Tidak ada kode aplikasi, backend, atau database yang diubah. Tidak ada fitur yang dihapus.** “Sembunyikan” atau “pindahkan” di bawah berarti mengatur prioritas tampilan, bukan menghapus kapabilitas.

## Urutan prioritas

### P0 — POS Kasir dan pembayaran

**Tujuan:** percepat transaksi rutin dan cegah salah paham antara pembayaran aktual dan mock.

- Bentuk ulang layar checkout menjadi: pilih kategori → pilih layanan/produk → periksa keranjang → bayar.
- Pada tablet landscape, pertahankan katalog dan keranjang dalam dua area yang mudah dibaca; keranjang, total, dan tombol bayar tidak ikut hilang saat katalog digulir.
- Buat target sentuh minimal 44px dan kurangi label kecil/ornamen. Hilangkan KPI demo, ringkasan pesanan, mesin, dan aktivitas terbaru dari konteks transaksi; pindahkan fungsi terkait ke halaman yang tepat.
- Sediakan data pelanggan/field hanya pada transaksi yang memerlukannya. Sebelum UI Drop Off diimplementasikan, pastikan dahulu bahwa informasi yang diminta memang didukung alur simpan saat ini; audit tidak mengusulkan perubahan API.
- Desain ulang pilihan pembayaran agar QRIS tidak terkesan diverifikasi jika hanya dicatat.
- Pertahankan gerbang buka shift. Rencanakan jalur tutup shift yang mudah ditemukan sebagai tugas operasional, tetapi jangan menggambarkan fitur sebagai tersambung sebelum UI/API benar-benar terhubung.

### P1 — Kejelasan informasi Owner dan halaman operasional

**Tujuan:** Owner dapat menemukan angka penting dengan cepat; Kasir dapat memindai antrean dan laporan.

- Dashboard Owner: dahulukan pendapatan aktual dan beberapa indikator operasional; pindahkan detail/ekspor ke Laporan Keuangan. Hilangkan KPI unavailable dari ringkasan utama tanpa menghapus penjelasan bahwa pengeluaran/laba belum tersedia.
- Dashboard Kasir: ganti angka contoh dengan status data yang jelas; jangan menampilkan ringkasan transaksi sebagai angka aktual bila belum ada query.
- Pesanan Laundry: kurangi ringkasan duplikat, buat daftar ringkas, dan pindahkan detail/status ke drawer. Tampilkan penanda prototipe dengan jelas.
- Laporan Keuangan Owner: fokus pada periode, ringkasan, tabel, dan ekspor; sampaikan batas maksimal hasil dan tidak tersedianya pengeluaran secara ringkas.
- Absensi Owner: pertahankan filter dan daftar, sederhanakan kartu angka, dan jangan tampilkan shift seakan selalu tersedia bila relasi check-in belum tercatat.

### P2 — Riwayat, inventaris, koin, dan laporan shift

**Tujuan:** susun halaman panjang berdasarkan tugas utama; kurangi panel/kolom dan status mock yang menyerupai data aktual.

- Riwayat Transaksi: jadikan tabel/list sebagai fokus; pindahkan nota ke drawer; hilangkan tombol ekspor/cetak yang saat ini hanya mengirim pesan toast dari tampilan utama.
- Produk & Stok: prioritaskan stok rendah dan perubahan stok; pindahkan log penuh ke halaman/section riwayat. Tandai data contoh di dekat tabel.
- Manajemen Koin: tampilkan saldo per jenis dan aksi utama secara ringkas; pindahkan panduan ke disclosure/bantuan dan singkirkan label live dari mock.
- Laporan Shift: susun filter → ringkasan → daftar shift → detail pilihan; pertahankan rincian metode bayar/waktu. Sembunyikan cetak yang belum bekerja dan tandai mock.

### P3 — Login, pengaturan, bantuan, dan konsistensi visual

**Tujuan:** hilangkan variasi desain yang tidak membantu dan satukan akses pengaturan.

- Login bersama: pertahankan brand, field, error, dan toggle password; sederhanakan ilustrasi/poin/footer.
- Pengaturan Kasir: pertahankan preferensi yang nyata dan tema; pindahkan profil outlet ke pengaturan Owner, perangkat/printer ke area tersendiri, dan jangan menampilkan simpan untuk perubahan yang hanya lokal.
- Pusat Bantuan: satukan kategori dan pencarian menjadi pencarian + daftar artikel; tampilkan panduan kontekstual di tempat kerja.
- Owner Integrasi Google Sheets: tetap jujur menyatakan belum tersedia, namun pindahkan dari navigasi operasional harian ke Pengaturan.
- Pengaturan Bisnis Owner: fokus pada nama/alamat/telepon; pindahkan fakta lain ke informasi ringkas.
- Absensi Karyawan: pertahankan tanggal dan tombol sesuai status, sederhanakan bingkai, serta samakan tema.
- Satukan tokens warna, font, ukuran, komponen tombol/form/tabel, dan mode gelap/terang.

## Rencana per halaman

Klasifikasi: **KEEP** = tetap terlihat; **SIMPLIFY** = sederhanakan; **MOVE** = pindahkan, tetap tersedia; **HIDE** = hilangkan dari tampilan utama/normal saja, tanpa menghapus fungsinya.

| Halaman dan sumber | Kendala saat ini | KEEP | SIMPLIFY | MOVE | HIDE dari tampilan utama | Hasil UX yang diharapkan |
|---|---|---|---|---|---|---|
| POS & pembayaran — [`CashierApp.jsx`](../src/features/cashier/CashierApp.jsx), [`catalog.js`](../src/features/cashier/data/catalog.js), [`style.css`](../src/style.css) | Terlalu banyak kelompok visual; keranjang berbagi ruang dengan katalog; data contoh dan informasi sekunder bercampur | Kategori, katalog, harga/satuan, keranjang, total, pembayaran | Kartu layanan, navigasi, ringkasan keranjang, checkout; target sentuh | Aktivitas terbaru ke Dashboard; koin/mesin ke halaman terkait | KPI contoh, penghias/status yang tidak mendukung transaksi | Alur checkout jelas, cepat, dan nyaman dipakai sentuh |
| Buka shift — [`CashierApp.jsx`](../src/features/cashier/CashierApp.jsx), [`owner-entry.css`](../src/shared/styles/entry.css) | Gerbang tugas memakai gaya kartu Login/Absensi dan aksi akhir shift tidak tampak di UI yang ditinjau | Jenis shift, error, tombol buka shift | Satu layar fokus dan kontrol besar | Tindakan tutup shift ke tugas akhir shift bila implementasi UI tersedia | Ornamen login yang tidak relevan | Awal kerja mudah; status shift tidak membingungkan |
| Dashboard Kasir — [`CashierDashboard.jsx`](../src/features/cashier/components/CashierDashboard.jsx), [`pages.css`](../src/features/cashier/styles/pages.css) | Empat metrik dan daftar hardcoded | Akses cepat ke transaksi dan ringkasan yang terverifikasi | Jumlah metrik dan struktur ringkasan | Riwayat transaksi ke halaman riwayat | Angka/nama mock yang tampil seperti aktual | Dashboard tidak memberi kesan data palsu |
| Pesanan Laundry — [`OrderManagement.jsx`](../src/features/cashier/components/OrderManagement.jsx), [`pages.css`](../src/features/cashier/styles/pages.css) | Ringkasan berulang, tabel lebar, detail di drawer, status mock | Daftar, pencarian/status, progres, pembayaran, detail, pembaruan | Ringkasan jadi satu antrean dan row ringkas | Detail pelanggan/estimasi ke drawer | Metrik duplikat dan angka demo tanpa label | Kasir cepat menemukan order yang perlu tindakan |
| Riwayat Transaksi — [`TransactionHistory.jsx`](../src/features/cashier/components/TransactionHistory.jsx), [`history.css`](../src/features/cashier/styles/history.css) | Banyak metrik/filter/tombol serta nota tampil berdampingan; tombol ekspor belum bekerja | Pencarian, filter dasar, daftar dan detail nota | Filter lanjutan dan ringkasan | Nota ke drawer/detail | Tombol cetak/ekspor yang hanya memberi notifikasi; demo data tanpa penanda | Pencarian transaksi jelas dan detail tidak memenuhi layar |
| Produk & Stok — [`InventoryManagement.jsx`](../src/features/cashier/components/InventoryManagement.jsx), [`operations.css`](../src/features/cashier/styles/operations.css) | Tiga summary dan tabel lebar; histori terpisah; mock | Pencarian, stok, minimum, status, aksi penyesuaian | Summary dan kolom tabel | Histori lengkap ke section/layar histori | Data contoh dari tampilan operasional aktual | Pengecekan dan tindakan stok lebih mudah dipindai |
| Manajemen Koin — [`CoinManagement.jsx`](../src/features/cashier/components/CoinManagement.jsx), [`operations.css`](../src/features/cashier/styles/operations.css) | Dua aksi per jenis, panel panduan, histori, dan saldo mock | Saldo, jenis koin, masuk/keluar, histori | Tampilan saldo dan tindakan utama | Panduan ke bantuan/disclosure | Penanda “live/stok tersedia” bila sumber tetap mock | Pengelolaan lebih sederhana dan status data jujur |
| Laporan Shift — [`ShiftReports.jsx`](../src/features/cashier/components/ShiftReports.jsx), [`reports.css`](../src/features/cashier/styles/reports.css) | Banyak metrik, filter, daftar+detail dan aksi cetak; data mock | Filter, rekap metode, waktu, detail shift | Prioritaskan ringkasan dan daftar terpilih | Keterangan saldo laci ke bantuan | Tombol cetak belum aktif; angka mock tanpa konteks | Rekap shift mudah dipahami tanpa klaim palsu |
| Pengaturan Kasir — [`SettingsPage.jsx`](../src/features/cashier/components/SettingsPage.jsx), [`operations.css`](../src/features/cashier/styles/operations.css) | Form lokal bercampur dengan profil outlet; tombol simpan menimbulkan ekspektasi persistensi | Tema dan preferensi yang betul-betul dipakai | Kelompok tab dan toggle | Profil outlet ke Owner; printer ke konfigurasi perangkat | Form simpan yang tidak menyimpan ke server | Pengguna tidak salah mengira perubahan sudah persisten |
| Pusat Bantuan — [`HelpPage.jsx`](../src/features/cashier/components/HelpPage.jsx), [`operations.css`](../src/features/cashier/styles/operations.css) | Kategori dan search menawarkan jalur pencarian berulang | Artikel, accordion, pencarian | Satu daftar artikel terfilter | Panduan transaksi/stok ke konteks terkait | Kartu kategori duplikatif dan notice yang berulang | Bantuan cepat tanpa dashboard kecil di dalam help |
| Dashboard Owner — [`OwnerDashboard.jsx`](../src/features/owner/components/OwnerDashboard.jsx), [`owner-dashboard.css`](../src/features/owner/styles/owner-dashboard.css) | Banyak panel; pengeluaran/laba unavailable berada sejajar dengan KPI aktual | Pendapatan, periode, pembayaran, status order, layanan, transaksi, kehadiran | Urutan dan kepadatan ringkasan | Ekspor/analisis rinci ke Laporan Keuangan | Kartu unavailable dari area KPI utama | Keputusan harian terlihat tanpa kebisingan visual |
| Laporan Keuangan Owner — [`OwnerModule.jsx`](../src/features/owner/components/OwnerModule.jsx), [`owner.css`](../src/features/owner/styles/owner.css) | Ringkasan, filter, tabel; hasil API dibatasi 200 | Periode, ringkasan, filter, tabel, CSV | Prioritas filter dan tinggi panel | Filter lanjutan menjadi disclosure | Panel pengeluaran/laba yang tidak didukung sebagai KPI | Pelacakan transaksi jelas dan batas data transparan |
| Absensi Owner — [`AttendanceAdmin.jsx`](../src/features/owner/components/AttendanceAdmin.jsx), [`owner.css`](../src/features/owner/styles/owner.css) | Statistik dan note menambah panel; filter shift perlu konteks | Tanggal, pencarian, daftar, status, waktu | Kartu statistik dan filter | Keterangan aturan kehadiran ke bantuan | Angka/label shift yang tidak didukung data aktual | Absensi lebih mudah disaring tanpa salah tafsir |
| Harga & Promo Owner — [`OwnerModule.jsx`](../src/features/owner/components/OwnerModule.jsx), [`owner.css`](../src/features/owner/styles/owner.css) | Tabel tarif aktif disandingkan kartu promo yang belum berfungsi | Tarif, pencarian/kategori, edit/simpan | Filter dan dialog harga | Promo ke area roadmap/submenu saat tersedia | Placeholder promo dari tugas ubah tarif | Perubahan tarif tetap cepat, batas fitur jelas |
| Integrasi Owner — [`OwnerModule.jsx`](../src/features/owner/components/OwnerModule.jsx), [`owner.css`](../src/features/owner/styles/owner.css) | Satu halaman navigasi sendiri untuk integrasi yang belum ada | Status belum terhubung dan penjelasan | Kartu status | Pengaturan/Integrasi | Tidak perlu menjadi item kerja harian; status tetap tersedia di pengaturan | Navigasi Owner lebih berfokus pada pekerjaan aktif |
| Pengaturan Bisnis Owner — [`OwnerModule.jsx`](../src/features/owner/components/OwnerModule.jsx), [`owner.css`](../src/features/owner/styles/owner.css) | Form outlet bercampur dengan fakta zona waktu/metode bayar | Nama, alamat, telepon, aksi simpan | Satu kelompok identitas outlet | Fakta operasional ke bagian informasi | Penjelasan repetitif yang bukan kontrol | Profil outlet mudah dikelola |
| Absensi Karyawan — [`AttendancePage.jsx`](../src/features/employee/components/AttendancePage.jsx), [`owner-entry.css`](../src/shared/styles/entry.css) | Layout turunan login dan theme tidak mengikuti pemilih aplikasi | Tanggal, waktu masuk/pulang, aksi sesuai status, logout | Kartu dan ornament | Petunjuk waktu ke detail bantu bila perlu | Decoration login yang tidak berkaitan | Check-in/check-out menjadi fokus dan mudah disentuh |
| Login bersama — [`LoginPage.jsx`](../src/features/auth/LoginPage.jsx), [`owner-entry.css`](../src/shared/styles/entry.css) | Ilustrasi/teks promosi menguasai area; ukuran teks kecil | Brand, username/email, password, toggle, error | Kolom ilustrasi dan footer | Bantuan koneksi/akun ke pesan bantuan ringkas | Poin promosi yang tidak membantu login | Masuk cepat dan tetap mudah dibaca |
| Login Owner lama — [`OwnerLogin.jsx`](../src/features/owner/components/OwnerLogin.jsx) | Komponen bukan jalur login yang dipakai entry; autentikasi hanya prototipe | Tidak menjadi rute aktif; jika komponen dipakai kembali, harus mengikuti login bersama | — | Hanya simpan sebagai legacy internal atau akseskan setelah evaluasi | Jangan tampilkan sebagai alur login alternatif | Mencegah jalur login yang membingungkan tanpa menghapus fitur kode |

## Kriteria penerimaan sebelum implementasi dinyatakan selesai

1. Skenario transaksi Self Service dapat diselesaikan dengan alur pendek tanpa input pelanggan yang tidak diperlukan.
2. Pada tablet landscape 1024×768 dan 1280×800, item katalog, keranjang, total, dan tindakan bayar terbaca tanpa keranjang tertutup oleh area lain.
3. Kontrol inti memiliki target sentuh minimal 44×44px; total/tombol bayar tetap terjangkau saat daftar digulir.
4. Nilai mock, nilai aktual, unavailable, loading, error, dan kosong dapat dibedakan tanpa indikator “live” yang keliru.
5. Semua halaman yang tersedia di Light Mode juga memiliki pasangan Dark Mode yang terbaca, termasuk modal, form, tabel, absensi, dan state error.
6. Kontras teks normal memenuhi WCAG AA; tidak ada informasi operasional penting di bawah 12px.
7. Kemampuan saat ini tetap dapat ditemukan meskipun kontrol dipindahkan; tidak ada fitur yang dihapus pada tahap audit/redesign ini.
8. Tidak ada alur UI yang mengklaim pembayaran QRIS, simpan pengaturan, ekspor, cetak, atau data laporan berhasil jika backend/perangkat belum melakukannya.

## Batas implementasi dan persetujuan

Rencana ini tidak mengubah kode. Beberapa temuan menyentuh batas backend—misalnya data Drop Off, transaksi tersimpan, status QRIS, stok/koin/laporan Kasir, dan tutup shift dari UI. Tahap implementasi harus dipisah: perubahan visual saja dapat dilakukan setelah disetujui; fitur yang memerlukan API/schema perlu persetujuan eksplisit dan perencanaan terpisah. Tidak ada perubahan backend/database yang termasuk dalam persetujuan audit ini.
