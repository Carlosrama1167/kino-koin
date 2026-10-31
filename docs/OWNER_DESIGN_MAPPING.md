# Pemetaan Integrasi Desain Owner KINO Laundry POS

## Status dan ruang lingkup

Dokumen ini menyelesaikan **Tahap Pertama: analisis dan pemetaan saja**. Belum ada implementasi UI, perubahan kode aplikasi, backend, database, atau dependency. Implementasi menunggu persetujuan pengguna.

Referensi dibaca secara read-only dari `C:\Users\zyrex Pro\Downloads\baru.zip`. ZIP berisi `DESIGN.md`, enam berkas `code.html`, dan enam screenshot `screen.png` untuk Dashboard Owner, Laporan Keuangan, Karyawan & Shift, Harga & Promo, Integrasi, dan Pengaturan. Direktori `design-reference/owner-redesign/` yang disebutkan belum ditemukan di root proyek; ZIP di Downloads menjadi sumber referensi yang dianalisis. Berkas desain tidak dipindahkan atau dihapus.

## Status perubahan proyek

- Pemeriksaan `git status --short --branch` gagal karena `D:\vibe coding\kino-koin` bukan repository Git (tidak ada `.git` di root). Karena itu, status bersih/kotor dan daftar perubahan belum tersimpan **tidak dapat dipastikan melalui Git**.
- `AGENTS.md`, `PROJECT_CONTEXT.md`, dan `PROGRESS.md` tidak ditemukan pada root.
- Dokumen yang tersedia dan telah dibaca: [`UI_UX_AUDIT.md`](UI_UX_AUDIT.md), [`UI_UX_GUIDELINES.md`](UI_UX_GUIDELINES.md), [`REDESIGN_PLAN.md`](REDESIGN_PLAN.md), serta [`architecture-and-flows.md`](architecture-and-flows.md).

## A. Implementasi Owner saat ini

### Struktur, routing, dan navigasi

- Entry Vite berada di [`main.jsx`](../src/main.jsx), sementara pemulihan sesi dan pemilihan role berada di [`Root.jsx`](../src/app/Root.jsx). Setelah autentikasi sesi dipulihkan melalui `/api/auth/me`, role `owner` diarahkan ke `OwnerPortal`. Tidak ada React Router; navigasi Owner mengganti halaman lewat state `active`.
- Shell, sidebar, menu aktif, outlet, profil, tema, logout, dan toast berada di [`OwnerPortal.jsx`](../src/features/owner/components/OwnerPortal.jsx).
- Sidebar aktif saat ini berupa navigasi vertikal berlabel: Dashboard Owner, Laporan Keuangan, Manajemen Karyawan & Shift, Manajemen Harga & Promo, Integrasi Google Sheets, dan Pengaturan Bisnis. Header menampilkan outlet, halaman, tombol tema, dan pengguna.
- Dashboard ada di [`OwnerDashboard.jsx`](../src/features/owner/components/OwnerDashboard.jsx). Modul laporan keuangan, harga/promo, integrasi, dan pengaturan bisnis dipilih melalui [`OwnerModule.jsx`](../src/features/owner/components/OwnerModule.jsx). Daftar absensi Owner berada di [`AttendanceAdmin.jsx`](../src/features/owner/components/AttendanceAdmin.jsx).
- Login Owner tetap menggunakan [`LoginPage.jsx`](../src/features/auth/LoginPage.jsx), sama seperti role lain. Jangan mengganti flow login atau memunculkan kembali [`OwnerLogin.jsx`](../src/features/owner/components/OwnerLogin.jsx) yang tidak digunakan oleh entry aktif.

### Data/API dan kemampuan yang benar-benar tersedia

| Halaman aktif | Koneksi aktual | Batas penting |
|---|---|---|
| Dashboard Owner | `GET /api/owner/dashboard`: pendapatan transaksi lunas, pembayaran tunai/QRIS, status laundry, grafik harian, transaksi terbaru, kehadiran, layanan teratas | Tidak ada expense/profit; data order tidak difilter periode pada query yang dibaca |
| Laporan Keuangan | `GET /api/owner/finance`: transaksi, total, ringkasan pembayaran, filter periode/metode/status/pencarian; ekspor CSV dibuat di frontend | Maksimal 200 baris per permintaan; tidak ada biaya, laba, dividen, pajak, atau buku besar kas/bank |
| Manajemen Karyawan & Shift | `GET /api/attendance`: daftar akun Kasir/Karyawan dan catatan absensi dengan filter tanggal/nama/shift | Halaman hanya baca. UI tidak membuat akun, mengelola jadwal/roster, gaji, laci kas, rating, atau presensi live |
| Manajemen Harga & Promo | `GET /api/owner/services`, `PUT /api/owner/services/price` | Harga normal/malam layanan dapat diedit; promo, kupon, ongkir, dan katalog/stok produk Owner tidak tersedia |
| Integrasi Google Sheets | Tidak ada endpoint integrasi yang digunakan; UI saat ini menyatakan belum terkonfigurasi | Jangan tampilkan sinkronisasi aktif, kuota, log, OAuth, atau status sukses dari desain |
| Pengaturan Bisnis | `GET/PUT /api/owner/outlet`: nama, alamat, telepon outlet aktif | Pengaturan perangkat, koin, shift, keamanan, WhatsApp, dan IoT tidak tersedia di API Owner |

Komunikasi API menggunakan helper [`api.js`](../src/shared/api.js), termasuk cookie session dan token CSRF untuk request mutasi. Autentikasi dan role check server tidak boleh dilewati oleh perubahan visual.

### State dan Light/Dark Mode

- `OwnerPortal` mengelola halaman terpilih, drawer mobile, toast, dan state tema. Tema Owner disimpan terpisah di `localStorage` dengan key `kino-owner-theme`.
- Token dasar Owner berada di [`owner.css`](../src/features/owner/styles/owner.css), detail dashboard di [`owner-dashboard.css`](../src/features/owner/styles/owner-dashboard.css), dan layout outlet/responsif di [`owner-single-outlet.css`](../src/features/owner/styles/owner-single-outlet.css). Typography bersama ditentukan di [`typography.css`](../src/shared/styles/typography.css).
- Tidak ada state server tambahan di shell; setiap halaman memuat data melalui API sendiri.
- Tema merupakan state presentasi. Jangan menghubungkannya ke tarif malam atau aturan bisnis.

## B. Analisis referensi desain

### Isi dan teknologi

| File referensi dalam ZIP | Fokus layar |
|---|---|
| `stitch_kino_laundry_pos_system/dashboard_owner_tablet_kino_laundry_pos/code.html` + `screen.png` | Dashboard pendapatan, pembayaran, layanan, tren, peringatan koin, rekap shift |
| `stitch_kino_laundry_pos_system/laporan_keuangan_tablet_kino_laundry_pos/code.html` + `screen.png` | Laba/beban, arus kas, komposisi pembayaran, dividen, buku besar |
| `stitch_kino_laundry_pos_system/karyawan_shift_tablet_kino_laundry_pos/code.html` + `screen.png` | Petugas aktif, roster, absensi, kas laci, payroll, rating |
| `stitch_kino_laundry_pos_system/harga_promo_tablet_kino_laundry_pos/code.html` + `screen.png` | Tarif layanan, aturan malam, ongkir, kupon, katalog retail/add-on |
| `stitch_kino_laundry_pos_system/integrasi_tablet_kino_laundry_pos/code.html` + `screen.png` | Sinkronisasi Sheets, target sheet, kuota, pipeline dan transmission log |
| `stitch_kino_laundry_pos_system/pengaturan_tablet_kino_laundry_pos/code.html` + `screen.png` | Profil usaha, hardware/koin, keamanan, kebijakan shift, WhatsApp dan IoT |
| `stitch_kino_laundry_pos_system/kino_laundry_pos/DESIGN.md` | Palet, tipografi, spacing, bentuk, elevation dan rekomendasi touch target |

HTML referensi adalah mockup layar statis, bukan komponen React yang siap dipasang. Markup memuat Tailwind Play CDN (`cdn.tailwindcss.com`), Google Fonts (Plus Jakarta Sans dan JetBrains Mono), serta Material Symbols dari Google Fonts. Tidak ada `package.json` atau paket React reusable dalam ZIP. Dependency aktif proyek sendiri tersedia di [`package.json`](../package.json): React, Vite, Tailwind plugin, dan `lucide-react`.

Dokumen `DESIGN.md` mengusulkan palet biru/cyan/hijau, Plus Jakarta Sans, skala jarak dan target sentuh besar, serta mencantumkan surface Dark Mode. Namun, HTML layar adalah mockup light; pemeriksaan tidak menemukan stylesheet media/breakpoint pada `<style>` internal atau implementasi theme toggle yang membuktikan dark theme siap pakai. Ikon `light_mode` di tampilan tidak cukup menjadi dukungan Dark Mode.

### Struktur visual dan tablet

- Referensi menggabungkan rail ikon vertikal di sisi kiri dengan navigasi horizontal berbentuk pill di bagian atas. Ini mengulang navigasi, dan rail ikon pada screenshot tidak selalu memberi label teks.
- Dashboard dan beberapa halaman memiliki banyak kartu, panel besar, badge, grafik, dan tabel panjang. Secara visual palet bersih dan tipografi dominan konsisten, tetapi kepadatan informasi tinggi—khususnya laporan, karyawan, pengaturan, dan halaman tarif/promo.
- Screenshot menampilkan layout lebar dan beberapa kolom; code HTML menggunakan utility layout Tailwind, tetapi tidak menunjukkan breakpoint media query internal. Responsivitas tablet yang lebih kecil/portrait belum terbukti.
- `DESIGN.md` menyarankan target sentuh 48px dan tombol utama 56–64px. Ini arahan desain; belum tervalidasi sebagai ukuran semua kontrol pada markup screenshot.
- Mockup memakai nama, tanggal Oktober 2026, nominal, persentase, jumlah staf, saldo kas/koin, kuota API, dan status “live/terkoneksi”. Angka/nama tersebut contoh desain, bukan data aktual KINO POS.

## C. Pemetaan fitur dan tindakan integrasi

| Fitur | Komponen lama | Referensi desain baru | Tindakan yang direkomendasikan |
|---|---|---|---|
| Shell Owner dan navigasi | `OwnerPortal.jsx`, `owner.css`, `owner-single-outlet.css` | Rail ikon kiri + tab horizontal: Ringkasan, Laporan, Karyawan, Harga, Integrasi, Pengaturan | **Adaptasi, jangan salin shell ganda.** Pertahankan `OwnerPortal` sebagai pemilik auth, menu aktif, tema, logout, dan toast. Ambil prinsip visual (permukaan terang, active state jelas, spacing, toolbar) dan terapkan pada satu navigasi berlabel. Pertahankan layout outlet tunggal. |
| Dashboard | `OwnerDashboard.jsx`, `owner-dashboard.css`; data dari `/api/owner/dashboard` | Dashboard dengan pendapatan bulanan/hari ini, total transaksi, tren, kanal bayar, layanan terlaris, peringatan koin, tabel shift/aktivitas | **Adaptasi visual dan susun ulang dengan API lama.** Pertahankan pendapatan, pembayaran, chart, layanan, pesanan, transaksi terbaru, absensi, periode, refresh dan CSV aktual. Abaikan nilai demo dan indikator palsu; jangan menambah tabel shift atau koin yang tidak didukung. |
| Laporan keuangan | `OwnerModule.jsx` → `FinanceReport`; `/api/owner/finance` | Laba bersih, beban, pajak, arus kas/bank, dividen, chart, ledger dan ekspor XLSX | **Adaptasi terbatas.** Reuse periode, tabel transaksi, filter dan ekspor CSV yang sudah bekerja. Style dapat mengambil hirarki judul/summary dari referensi. Jangan menampilkan beban, laba, pajak, dividen, bank, ledger, atau XLSX sebagai fungsi tersedia; API saat ini hanya mendukung transaksi/pembayaran. |
| Karyawan & shift | `AttendanceAdmin.jsx`; `GET /api/attendance` | Petugas on-duty, roster shift mingguan, payroll/lembur, akurasi laci, rating, tindakan tambah staf | **Adaptasi sebagai tampilan absensi baca-saja.** Reuse tabel/timestamp/status dan filter tanggal/nama/shift yang sudah ada. Abaikan angka dan personel demo. Jangan menambah edit roster, payroll, rating, kas laci, presensi live, download, atau tambah karyawan yang tidak didukung. |
| Harga layanan | `OwnerModule.jsx` → `PriceManagement`; GET/PUT service price | Kartu tarif Self Service/Drop Off, Night Owl, paket, stok retail/add-on, kupon | **Reuse logika dan API lama; adaptasi tampilan tabel/daftar harga.** Hanya layanan yang dikembalikan API dapat diedit. Pertahankan validasi dan save flow existing. Harga/discount/produk/stock mock dari desain tidak boleh diimpor. |
| Promo | Bagian `PriceManagement` yang menyatakan promo belum tersedia | Form kupon, daftar kupon live, klaim/penggunaan dan diskon otomatis | **Jangan integrasikan sebagai kontrol aktif.** Endpoint/tabel promo tidak ada. Keterangan belum tersedia boleh dipertahankan secara ringkas di area sekunder jika relevan. |
| Integrasi Google Sheets | `OwnerModule.jsx` → `IntegrationStatus` | Sinkronisasi paksa, spreadsheet ID, OAuth, kuota, frekuensi, telemetri, transmission log | **Pertahankan status belum dikonfigurasi.** Gunakan paling jauh gaya status/panel referensi, tetapi jangan tampilkan connected, 100%, kuota, log, trigger, atau tombol sinkronisasi karena tidak ada API integrasi. |
| Pengaturan bisnis | `OwnerModule.jsx` → `BusinessSettings`; GET/PUT outlet | Pengaturan multi-tab profil/nota, mesin/koin, keamanan, laci, kebijakan shift, WhatsApp, IoT, hardware | **Reuse form profil outlet aktual** (nama, alamat, telepon) serta status loading/error/save. Gunakan panel sederhana dari referensi. Semua opsi teknis/keamanan/perangkat yang tak memiliki API tetap tidak aktif/tidak ditampilkan sebagai konfigurasi tersimpan. |
| Light/Dark Mode | State dan localStorage di `OwnerPortal`; token `owner.css` | Icon `light_mode` dan palet light/dark dalam `DESIGN.md` | **Adaptasi tokens, bukan theme code dari mockup.** Pertahankan toggle/state lokal yang ada, audit semua komponen untuk token semantik Light/Dark, serta pastikan status/kontras konsisten. Jangan menganggap icon pada mockup sebagai implementasi Dark Mode. |
| Tipografi/ikon | Plus Jakarta Sans dan Inter; `lucide-react`; `typography.css` | Plus Jakarta Sans + JetBrains Mono + Material Symbols | **Reuse font dan ikon yang sudah terpasang.** Ambil hierarchy judul/angka seperlunya. Jangan menambah JetBrains Mono atau Material Symbols dependency; untuk angka, gunakan font angka proporsional/tabular yang tersedia tanpa mengganti semua body font. |
| Komponen panel, tabel, filter, tombol | CSS Owner dan elemen React existing | Banyak kartu soft-blue, badges, table, rounded panels, CTA hitam/biru | **Adaptasi selektif.** Reuse markup/state existing dan rapikan CSS. Kurangi kartu yang redundant; buat warna status informatif, bukan dekoratif. Kartu/mock statistik tidak boleh menimpa isi database. |

## Komponen yang berpotensi dipakai ulang

- **Dapat dipakai langsung sebagai basis integrasi:** `OwnerPortal` (session/user/role tetap dari parent, menu active dan theme), `OwnerDashboard` (query, kalkulasi ringkasan, periode, CSV), `FinanceReport` (filter dan CSV), `AttendanceAdmin` (filter/read-only), `PriceManagement` (load, validasi dan save), `BusinessSettings` (load/save), `IntegrationStatus` (keadaan belum tersambung).
- **Yang dipakai ulang adalah komponen/logika React saat ini, bukan HTML referensi:** HTML referensi tidak menyediakan komponen React yang terpisah; tiap halaman adalah contoh markup dan class utilitas.
- **Visual yang aman untuk diadaptasi:** warna permukaan dan primary, jarak, ukuran kontrol sentuh, hirarki heading, garis/border, state active, dan gaya table—dengan pengecekan kontras dan density.
- **Jangan diadopsi sebagai fitur:** indikator cloud sync live, transaksi/pendapatan/beban contoh, personel dan payroll, koin/hardware, kupon/promo, keamanan/laci, WhatsApp, IoT, OAuth/kuota/log sinkronisasi, serta tombol untuk aksi yang belum didukung.

## Risiko dan mitigasi

| Risiko | Dampak | Mitigasi integrasi |
|---|---|---|
| Angka/nama mock dari referensi masuk ke UI aktual | Owner mengambil keputusan dari nilai yang tidak berasal dari database | Gunakan state/data `OwnerDashboard`, `OwnerModule`, dan `AttendanceAdmin` saat ini; jangan salin data fixture atau nilai literal screenshot |
| Desain mengisyaratkan fitur lebih luas dari API | Ekspektasi palsu atau tombol yang tidak bekerja | Mapping per area berdasarkan endpoint di atas; fitur tanpa endpoint tetap berstatus belum tersedia |
| Penggantian layout shell mengubah autentikasi/navigation | Logout, role gate, atau perilaku akses regresi | Pertahankan `main.jsx`, `OwnerPortal` sebagai shell React dan callback `onLogout`; ubah presentasi, bukan sistem login/role |
| Referensi memakai Tailwind CDN/font/icon eksternal | Ketergantungan runtime ke jaringan dan tambahan dependency | Adaptasi CSS ke stylesheet lokal dan gunakan `lucide-react`, Inter/Plus Jakarta Sans, dan Tailwind yang sudah ada |
| Dual navigation terlalu padat di tablet | Ruang konten berkurang dan navigasi berulang | Pilih satu navigasi berlabel; gunakan drawer responsif pada lebar kecil |
| Layar reference padat dan belum terbukti responsive/dark | Overflows, target sentuh kecil, kontras buruk di tablet/tema gelap | Uji dashboard pada tablet landscape/portrait; tetapkan breakpoint dan token light/dark saat tahap implementasi |
| Aturan format/design referensi tidak sama dengan branding POS saat ini | Tipografi dan warna Owner berbeda dari Kasir | Selaraskan dengan token global dan typography.css; gunakan aksen referensi secara selektif |
| URL ZIP di luar workspace dan folder hasil ekstrak belum ada | Preview sulit diakses oleh build dan perubahan lokal | Jangan bergantung pada file ZIP saat runtime; minta file referensi ditempatkan di workspace hanya jika diperlukan dalam implementasi lanjutan |

## Urutan integrasi yang disarankan setelah persetujuan

1. **Shell dan tokens Owner:** sederhanakan navigasi tunggal, header, spacing dan card; pertahankan session/user/logout, active page, toast dan theme state.
2. **Dashboard Owner:** adaptasi grid dan hirarki referensi pada data API aktual yang sudah dipakai. Audit responsive Light/Dark.
3. **Laporan Keuangan:** terapkan visual referensi hanya pada periode/filter/table/summary yang didukung endpoint dan CSV.
4. **Absensi Owner dan manajemen tarif:** rapikan table, filter dan editor tanpa menambah fungsi di luar API saat ini.
5. **Integrasi dan Pengaturan:** pertahankan unavailable state integrasi dan hanya form outlet aktual; gaya dapat diselaraskan tanpa mengklaim fitur tambahan.
6. **Validasi:** build Vite, verifikasi flow owner auth/session/logout, request API dan error state, Light/Dark, viewport tablet 1024×768 dan 1280×800 serta portrait, kemudian cek bahwa tampilan Kasir tidak terpengaruh CSS global.

## Keputusan yang menunggu persetujuan

Persetujuan yang diminta adalah untuk memulai integrasi visual **shell + Dashboard Owner terlebih dahulu**, dengan batas berikut:

- Tidak ada perubahan autentikasi/role, URL behavior, API, database, atau perhitungan bisnis.
- Data tetap dari API/state lama; seluruh nilai mock pada ZIP tidak disalin ke aplikasi.
- Halaman lain belum diredesain sampai tahap dashboard tervalidasi.
- Tidak ada dependency baru; tidak ada commit atau push otomatis.

**Status: menunggu persetujuan.**
