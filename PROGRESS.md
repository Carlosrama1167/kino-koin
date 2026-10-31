# Progress

## Redesign Halaman Login

- Halaman masuk disederhanakan menjadi satu kartu responsif dengan wordmark KINO, field tanpa ikon dekoratif, tombol tampilkan kata sandi, tombol loading, dan pesan error inline.
- Mode Terang/Gelap dapat diganti melalui tombol di kartu dan pilihan disimpan di perangkat; sebelum pilihan pertama, tema mengikuti preferensi sistem. Fokus keyboard, indikator Caps Lock, autofill, target sentuh, dan aturan reduced motion didukung.
- Login tetap menggunakan endpoint dan alur autentikasi yang sama; backend, database, dan dependency tidak diubah.
- Validasi: `npm.cmd run build` berhasil. Pemeriksaan browser pada desktop, tablet, dan ponsel memastikan halaman tidak bergulir pada tinggi viewport yang diuji; tombol tampilkan kata sandi disediakan sebagai state interaktif.

## Tahap 2 — Shell dan Dashboard Owner

- Status: selesai untuk redesign visual seluruh halaman Owner yang telah tersedia.
- Dashboard tetap menggunakan data aktual dari endpoint `/api/owner/dashboard`; tidak ada mock data yang ditambahkan ke aplikasi.
- Seluruh tampilan Owner mengikuti bahasa visual referensi: rail navigasi, tab kapsul, kanvas abu terang membulat, panel putih bento, dan aksen biru. Halaman yang dicakup: Dashboard, Laporan Keuangan, Karyawan & Shift, Harga & Promo, Integrasi, dan Pengaturan Bisnis.
- Responsivitas dan Light/Dark Mode diterapkan ke shell serta modul. Target kontrol navigasi/filter sentuh dijaga sekurang-kurangnya 44px pada breakpoint tablet.
- Referensi yang diberikan adalah mockup halaman Pengaturan; hanya gaya visual yang diterapkan lintas halaman. Nilai, statistik, dan fitur contoh tidak disalin.
- Autentikasi, izin, alur API, fungsi bisnis, backend, database, dan dependency tidak diubah.
- Validasi: `npm run build` berhasil. Pemeriksaan browser dengan respons API mock sementara menguji navigasi keenam halaman, Light/Dark Mode, serta lebar 390, 768, dan 1280px tanpa overflow horizontal.
- Tidak ada skrip test pada `package.json`.

## Redesign Tampilan Kasir

- Status: selesai untuk shell navigasi dan halaman Kasir yang tersedia.
- Tampilan Kasir disesuaikan dengan referensi: rail navigasi, kanvas biru muda, panel putih, tipografi dan aksen biru, serta tata letak responsif.
- Styling dipisahkan dalam `src/roles/cashier/cashier-redesign.css` dan dimuat setelah stylesheet lain agar tidak mengubah tampilan Owner.
- Halaman Transaksi Baru difokuskan pada pemilihan kategori/layanan dan keranjang; ringkasan serta riwayat statis yang sebelumnya menduplikasi Dashboard dihapus.
- Fungsi transaksi, keranjang, pembayaran, navigasi, tema, dan data aplikasi tidak diganti. Tidak ada perubahan backend, database, atau dependency.
- Validasi: `npm.cmd run build` berhasil. Pemeriksaan browser mencakup sembilan halaman Kasir, cart dan modal pembayaran, Light/Dark Mode, serta viewport desktop, tablet (768px), dan ponsel (390px) tanpa overflow horizontal.
- Tidak ada skrip test pada `package.json`.

## Motion Owner

- Status: implementasi motion dibatasi pada area Owner; area Kasir dan alur bisnis tidak diubah.
- Navigasi shell tetap stabil; hanya root konten Owner yang memakai fade-in dan slide-up 8px selama 220ms.
- Kartu KPI Dashboard Owner mendapat entrance animation 260ms dengan stagger 20ms (maksimal 40ms); animasi berjalan saat kartu dibuat, bukan ketika nilai diperbarui.
- Grafik batang pendapatan aktual yang sudah ada tumbuh menggunakan transform/opacity selama 650ms. Data, API, dan filter tidak diubah; tidak ada grafik atau dependency baru.
- Modal edit tarif, transisi navigasi, focus-visible, dan status badge memperoleh motion ringan. Tooltip grafik memakai fade/slide 150ms serta dapat difokuskan dengan keyboard; dropdown tetap berupa kontrol native.
- `prefers-reduced-motion: reduce` menonaktifkan animasi/transisi dekoratif tanpa menghilangkan indikator fokus atau label status.
- Validasi: `npm.cmd run build` berhasil. Pemeriksaan browser dengan respons API yang di-mock sementara mencakup navigasi Owner berulang, filter 7 hari, Light/Dark Mode, modal tarif, tooltip hover/keyboard, dan `prefers-reduced-motion`; tidak ada error JavaScript/console pada pemeriksaan akhir.

## Restrukturisasi Struktur Proyek

- Status: selesai setelah persetujuan rencana; frontend dikelompokkan di `src/features/` berdasarkan auth, cashier, owner, dan employee.
- Root sesi/role diekstrak ke `src/app/Root.jsx`; `src/main.jsx` tetap menjadi entry Vite dan mempertahankan urutan impor stylesheet.
- Klien API dipindah ke `src/shared/api.js`; stylesheet lintas role ke `src/shared/styles/`; CSS Owner dan Kasir dikelompokkan dalam masing-masing fitur.
- Tidak ada perubahan pada API, backend, database, dependency, UI, atau logika bisnis. `src/style.css`, konfigurasi Vite, `.env`, dan folder backend/database tetap di lokasi semula.
- Dokumentasi struktur frontend dan referensi path terkait diperbarui. Rencana dan pemetaan tersedia di `docs/PROJECT_STRUCTURE_PLAN.md`.
- Validasi: `npm.cmd run build` berhasil. Smoke test browser dengan API mock meliputi enam halaman Owner, POS Kasir dengan state keranjang tetap terjaga saat navigasi, dan alur check-in Karyawan. Tidak ada uncaught JavaScript exception.

## Integrasi Sistem Kasir dan Owner

- Status: P0 dan P1 untuk aturan yang telah dikonfirmasi diterapkan; integrasi dashboard Owner P3 dibatasi ke outlet aktif tunggal. P2 masih menunggu keputusan tanggal operasional, pengingat, serah terima, dan rekonsiliasi fisik. P4 belum selesai.
- Checkout menyimpan transaksi dan detail, harga snapshot, pelanggan, catatan, berat, ongkir, diskon tervalidasi, metode/status pembayaran, dan nomor berbasis sequence. Idempotency key mencegah duplikasi retry; keranjang hanya dikosongkan setelah server mengonfirmasi sukses.
- Pembayaran tunai tercatat sebagai lunas. Pelunasan tertunda dapat dicatat pada shift penerima; QRIS memerlukan konfirmasi manual kasir dengan petugas/waktu audit dan tidak diklaim terverifikasi provider. Pembayaran parsial/split dan refund belum tersedia.
- Kapasitas cuci/pengering 7 kg; jumlah mesin `ceil(berat/7)` dan harga siklus dikalikan mesin. Koin otomatis: satu reguler per mesin, dua untuk pasangan Cuci + Kering, satu Extra Dry khusus per pengering; ledger ditautkan ke transaksi.
- Riwayat dan pesanan Kasir bersumber dari API aktual; status laundry terpisah dari status pembayaran dan perubahan status dicatat. Penjualan produk memperbarui stok beserta mutasi dalam transaksi database; koreksi stok/koin melalui ledger meminta alasan.
- Sesi shift memiliki jadwal empat jenis, buka/tutup manual, dan ringkasan akhir shift; laporan pembayaran mengelompokkan shift penerima. Rekonsiliasi fisik, handover, reminder, serta tanggal operasional belum tersedia.
- Dashboard Owner mengambil data aktual dan menampilkan stok, saldo/pengeluaran koin, serta sesi shift terbaru; query dibatasi ke satu outlet aktif sesuai keputusan pengguna.
- Balasan terakhir diartikan bahwa saldo fisik koin Extra Dry adalah 30; saldo database tetap tidak ditimpa tanpa persetujuan eksplisit. Durasi Extra Dry tidak diubah. Beberapa kelompok cucian dalam satu transaksi juga belum didukung.
- Migrasi `20261031_001_integrated_checkout.sql` diterapkan ke database lokal yang diverifikasi `APP_ENV=local`, host `127.0.0.1`, DB `KinoKoinLoundry`; tidak ada perubahan ke produksi atau dependency.
- Validasi: `npm.cmd run build`, `php -l` API/bootstrap, query Owner, dan skema penulisan checkout/pembayaran/koin dalam transaksi uji yang di-rollback berhasil. Checkout E2E terhalang karena database lokal belum memiliki katalog Self Service dan saldo koin (keduanya nol); login browser lintas role/concurrency masih perlu diuji dengan data uji.
- Perbaikan menu Transaksi Baru: database lokal ternyata belum mendapat `database/seed.sql` (0 layanan aktif). Seed resmi berisi 12 layanan dalam 4 kategori telah diterapkan secara idempotent di database lokal. Menu Produk & Minuman tetap menunggu data produk nyata karena seed tidak menyediakan produk.
- Implementasi rinci, pemetaan API/tabel, risiko, dan aturan yang menunggu konfirmasi: `docs/FULL_SYSTEM_INTEGRATION_PLAN.md`.

## Revisi Owner — P0 Pengeluaran dan Laporan

- Status: kode expense Kasir/Owner, laporan keuangan, agregat shift, koreksi/audit Owner, bukti privat, idempotensi, dan relasi penerimaan stok telah disiapkan. UI kuartal di Dashboard dan Laporan Keuangan dihapus; API menolak periode `quarter`.
- Expense Tunai memakai sumber dana laci kas dan QRIS memakai rekening usaha; pemetaan ini telah dikonfirmasi.
- Setelah persetujuan eksplisit, migration `database/migrations/20261101_001_expense_ledger.sql` diterapkan hanya pada database lokal `KinoKoinLoundry` (`APP_ENV=local`, server `127.0.0.1`). Produksi tidak diubah.
- Laporan memisahkan nilai transaksi, pembayaran diterima, pengeluaran, serta arus kas bersih; arus kas bersih bukan laba. Penerimaan stok tetap alur terpisah dan dapat tertaut ke expense tanpa mutasi stok ganda.
- Validasi: `npm.cmd run build`, `php -l api/public/index.php`, dan `php -l api/bootstrap.php` berhasil. Uji database rollback-only pada DB lokal memverifikasi insert/agregat, audit, unique idempotency, aturan sumber QRIS, dan rollback; tidak ada fixture tersisa. Pemeriksaan browser Owner memastikan tema gelap, viewport 390px tanpa overflow horizontal, serta tidak ada filter Kuartal. Upload bukti dan API end-to-end dengan sesi autentik belum diuji; percobaan smoke UI Kasir gagal mendapat sesi auth mock.
- P1 karyawan/shift dan P2/P3 katalog produk/promo, Google Sheets, serta foto profil belum dikerjakan. Tidak ada commit atau push.
