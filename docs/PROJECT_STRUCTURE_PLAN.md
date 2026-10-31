# Rencana Restrukturisasi Struktur Proyek

## Status dan ruang lingkup

Dokumen ini mencatat audit awal, rekomendasi, serta hasil restrukturisasi setelah pengguna menyetujuinya. Kode frontend telah dipindahkan ke pengelompokan fitur; backend, database, endpoint API, autentikasi, perilaku aplikasi, dan dependency tidak diubah. Migrasi menggunakan restore point lokal karena repository Git tidak tersedia.

Audit dilakukan pada file proyek yang tersedia, tidak termasuk `node_modules/` dan `dist/` karena keduanya merupakan dependency terpasang dan output build. Folder proyek saat ini tidak memiliki metadata Git (`.git`), sehingga status perubahan dan rollback berbasis Git tidak dapat diverifikasi.

## 1. Struktur sebelum migrasi (audit awal)

```text
.
├── .agents/skills/             # Instruksi skill lokal untuk coding agent
├── api/
│   ├── bootstrap.php           # Environment, PDO, session, CSRF, respons JSON
│   ├── public/index.php        # PHP front controller dan endpoint API
│   └── scripts/                # Pembuatan akun melalui CLI
├── database/
│   ├── schema.sql
│   └── seed.sql
├── docs/                       # Arsitektur, audit UI/UX, redesign, pemetaan Owner
├── src/
│   ├── main.jsx                # Entry React, pemulihan sesi, pemilihan role, impor CSS
│   ├── lib/api.js              # Fetch JSON, cookie, CSRF, login/logout
│   ├── shared/components/      # Login bersama
│   ├── roles/
│   │   ├── cashier/            # Shell kasir, halaman, data UI, stylesheet redesign
│   │   ├── employee/           # Halaman absensi karyawan
│   │   └── owner/              # Shell Owner, dashboard, modul, absensi Owner
│   └── *.css                   # CSS dasar, kasir, Owner, entry, tipografi, motion
├── .env                        # Konfigurasi lokal/rahasia; tidak dicatat dalam dokumen
├── .env.example
├── index.html                  # Dokumen HTML yang memuat src/main.jsx
├── package.json / package-lock.json
├── README-backend.md
├── PROGRESS.md
└── vite.config.js
```

`node_modules/` dan `dist/` juga tampak di workspace, tetapi bukan sumber yang perlu direstrukturisasi.

## 2. Teknologi dan batas arsitektur

- **Frontend:** React 18, JavaScript/JSX, Vite, Tailwind CSS v4 melalui plugin Vite, dan `lucide-react`.
- **Entry:** `index.html` memuat `src/main.jsx`. `main.jsx` menginisialisasi React, memulihkan sesi lewat `/api/auth/me`, memilih tampilan login/Owner/Kasir/Karyawan, serta memuat stylesheet global.
- **Navigasi:** tidak ada React Router. Kasir dan Owner memilih halaman menggunakan state lokal; role ditentukan dari respons autentikasi. Path `/owner` atau `/kasir` bukan router halaman.
- **Layout:** `CashierApp.jsx` adalah shell Kasir, `OwnerPortal.jsx` shell Owner, dan `AttendancePage.jsx` layar mandiri Karyawan.
- **Komponen dan state:** komponen menggunakan state React lokal (`useState`, `useMemo`, `useEffect`). Tidak ditemukan Redux, Zustand, Context, atau store global. Keranjang, pembayaran, dan state shift berada di `CashierApp`; perpindahan antar menu saat ini terjadi di shell yang sama.
- **API bersama:** `src/lib/api.js` mengatur request, cookie session, CSRF, serta login/logout. Vite meneruskan `/api` ke `http://127.0.0.1:8000`.
- **Backend:** PHP dengan front controller `api/public/index.php`; PostgreSQL melalui PDO. Pengaturan dibaca dari `.env` root oleh `api/bootstrap.php`.
- **Database:** skema yang ditemukan mencakup outlet, pengguna, shift, absensi, pelanggan, layanan/harga, produk, transaksi/item/pembayaran, pesanan laundry, pengiriman, jenis/pergerakan koin, pergerakan inventaris, dan sync jobs. Restrukturisasi frontend tidak mengubah skema ini.
- **Test dan script:** `package.json` hanya menyediakan `dev`, `build`, dan `preview`; tidak ada skrip test proyek. Script aplikasi yang tersedia adalah `api/scripts/create_user.php` dan `api/scripts/create_initial_accounts.php`. Pencarian file test hanya menemukan test dependency di `node_modules`.
- **Asset:** tidak ditemukan folder asset/file gambar lokal dalam sumber. Font Inter dan Plus Jakarta Sans dimuat dari Google Fonts di `index.html`. Jangan membuat folder `assets/` kosong.
- **Membership:** tidak ditemukan modul membership frontend atau API khusus yang terverifikasi; jangan membuat folder/fitur membership berdasarkan contoh struktur.

### Modul yang benar-benar tampak pada UI

| Area | Implementasi yang ada | Catatan sumber data |
|---|---|---|
| Auth | `LoginPage.jsx`, session check di `main.jsx`, `lib/api.js` | API login/session tersedia |
| Kasir | POS, shift, dashboard, pesanan, histori, inventaris, koin, laporan shift, pengaturan, bantuan | POS/shift dan beberapa request tersambung; sebagian halaman Kasir menggunakan data prototipe |
| Owner | Dashboard, laporan keuangan, absensi, harga layanan, status integrasi, pengaturan outlet | Dashboard/laporan/harga/absensi/profil memiliki endpoint; integrasi Sheets belum tersedia |
| Karyawan | Absensi mandiri | Endpoint absensi tersedia |

Nama modul pada struktur target sebaiknya mencerminkan implementasi aktual. Hindari memecah folder `transactions`, `orders`, `shifts`, atau `inventory` yang berdiri sendiri apabila saat ini logika UI-nya memang bagian dari `CashierApp` dan belum memiliki batas modul independen.

## 3. Masalah organisasi yang ditemukan

1. **`roles/` memberi pengelompokan per role, tetapi istilahnya berbeda dengan pola feature-first** dan membuat reusable API berada di `lib/` yang terpisah.
2. **Login bersama berada di `shared/components`, sedangkan state pemulihan sesi dan role ada di `main.jsx`.** Tanggung jawab autentikasi tersebar, walau belum cukup alasan untuk mengubah logika sesi pada pemindahan file.
3. **Folder `components/` memuat layar/halaman penuh**, misalnya Dashboard, Riwayat, laporan, dan pengaturan. Nama folder tidak membedakan layar dari komponen kecil; hindari rename massal pada tahap yang sama.
4. **Banyak stylesheet berada langsung di root `src/`.** Ada kelompok CSS Kasir, Owner, tipografi, dan entry bersama; urutan impor saat ini di `main.jsx` memengaruhi cascade.
5. **`owner-entry.css` mempunyai pemakai lintas role.** Selain halaman Owner, stylesheet entry dipakai oleh layar absensi Karyawan dan gerbang buka shift Kasir. Memindahkannya khusus ke Owner akan merusak gaya role lain.
6. **CSS global `style.css` juga berisi styling layar aplikasi yang luas.** Memisahkan atau mengubah lingkup selector bukan pekerjaan pemindahan path sederhana.
7. **`OwnerModule.jsx` memuat beberapa subhalaman dalam satu file.** Memecah modul ini bukan prasyarat restrukturisasi dan berisiko memperluas perubahan.
8. **Ada `OwnerLogin.jsx` yang tidak digunakan oleh entry aktif.** Simpan di area Owner selama migrasi; evaluasi penghapusan secara terpisah dan hanya setelah konfirmasi.
9. **Belum ada folder test/asset/config aplikasi terpisah.** Tidak perlu membuat direktori kosong. `vite.config.js`, `.env`, `index.html`, `api/`, dan `database/` sudah memiliki lokasi fungsional yang tepat.
10. **Dokumentasi masih menyebut path frontend lama.** README dan beberapa dokumen arsitektur/pemetaan perlu diperbarui setelah pemindahan benar-benar disetujui.

## 4. Struktur target yang direkomendasikan dan diwujudkan

Struktur ini mempertahankan satu entry Vite, mengelompokkan kode aplikasi berdasarkan fitur, dan mempertahankan backend PHP pada batas yang sekarang. Inilah struktur yang diterapkan setelah persetujuan.

```text
.
├── .agents/
├── api/                        # Tidak dipindahkan: backend PHP dan script CLI
├── database/                   # Tidak dipindahkan: skema dan seed PostgreSQL
├── docs/
│   └── PROJECT_STRUCTURE_PLAN.md
├── src/
│   ├── main.jsx                # Tetap sebagai entry Vite dan pemuat CSS berurutan
│   ├── app/
│   │   └── Root.jsx            # Root: pemulihan sesi dan pemilihan role
│   ├── features/
│   │   ├── auth/
│   │   │   └── LoginPage.jsx
│   │   ├── cashier/
│   │   │   ├── CashierApp.jsx
│   │   │   ├── components/
│   │   │   ├── data/
│   │   │   └── styles/
│   │   ├── owner/
│   │   │   ├── components/
│   │   │   └── styles/
│   │   └── employee/
│   │       └── components/
│   ├── shared/
│   │   ├── api.js
│   │   └── styles/
│   │       ├── entry.css
│   │       └── typography.css
│   └── style.css               # Dipertahankan sementara sebagai CSS aplikasi lintas halaman
├── .env                        # Tetap di root; jangan dipindah atau didokumentasikan nilainya
├── .env.example
├── index.html
├── package.json
├── package-lock.json
├── README-backend.md
├── PROGRESS.md
└── vite.config.js
```

`main.jsx` tetap kecil sebagai entry Vite: impor gaya berurutan, render `Root`, dan tidak menangani implementasi fitur lebih lanjut. Pemindahan `Root` ke `app/Root.jsx` adalah satu pemisahan modul yang eksplisit, bukan perubahan routing. Tidak ada kebutuhan menambahkan React Router atau state manager.

## 5. Pemetaan file lama ke target

Tabel ini mencatat pemetaan yang diterapkan setelah persetujuan.

### Entry, auth, dan utilitas bersama

| Lokasi sekarang | Lokasi target | Tindakan/catatan |
|---|---|---|
| `src/main.jsx` | `src/main.jsx` + `src/app/Root.jsx` | Pertahankan entry Vite; ekstrak fungsi `Root` tanpa mengubah urutan pemilihan role atau perilaku sesi. |
| `src/shared/components/LoginPage.jsx` | `src/features/auth/LoginPage.jsx` | Halaman login aktif dipindah ke fitur auth. |
| `src/lib/api.js` | `src/shared/api.js` | Klien API digunakan lintas role; pertahankan URL endpoint, cookie, CSRF, dan penanganan error. |
| `src/roles/owner/components/OwnerLogin.jsx` | `src/features/owner/components/OwnerLogin.jsx` | Dipindahkan bersama area Owner, tetapi tetap ditandai legacy/tidak aktif; bukan pengganti login bersama. |

### Kasir

| Lokasi sekarang | Lokasi target |
|---|---|
| `src/roles/cashier/CashierApp.jsx` | `src/features/cashier/CashierApp.jsx` |
| `src/roles/cashier/components/CashierDashboard.jsx` | `src/features/cashier/components/CashierDashboard.jsx` |
| `src/roles/cashier/components/CoinManagement.jsx` | `src/features/cashier/components/CoinManagement.jsx` |
| `src/roles/cashier/components/HelpPage.jsx` | `src/features/cashier/components/HelpPage.jsx` |
| `src/roles/cashier/components/InventoryManagement.jsx` | `src/features/cashier/components/InventoryManagement.jsx` |
| `src/roles/cashier/components/OrderManagement.jsx` | `src/features/cashier/components/OrderManagement.jsx` |
| `src/roles/cashier/components/SettingsPage.jsx` | `src/features/cashier/components/SettingsPage.jsx` |
| `src/roles/cashier/components/ShiftReports.jsx` | `src/features/cashier/components/ShiftReports.jsx` |
| `src/roles/cashier/components/TransactionHistory.jsx` | `src/features/cashier/components/TransactionHistory.jsx` |
| `src/roles/cashier/data/catalog.js` | `src/features/cashier/data/catalog.js` |
| `src/roles/cashier/data/inventory.js` | `src/features/cashier/data/inventory.js` |
| `src/roles/cashier/data/mockData.js` | `src/features/cashier/data/mockData.js` |
| `src/roles/cashier/data/shiftReports.js` | `src/features/cashier/data/shiftReports.js` |
| `src/roles/cashier/data/transactionHistory.js` | `src/features/cashier/data/transactionHistory.js` |
| `src/roles/cashier/cashier-redesign.css` | `src/features/cashier/styles/cashier-redesign.css` |

Nama komponen dipertahankan. Pemindahan tidak boleh mengubah state keranjang/pembayaran, request API, navigasi menu, atau data prototipe.

### Owner dan Karyawan

| Lokasi sekarang | Lokasi target |
|---|---|
| `src/roles/owner/components/OwnerPortal.jsx` | `src/features/owner/components/OwnerPortal.jsx` |
| `src/roles/owner/components/OwnerDashboard.jsx` | `src/features/owner/components/OwnerDashboard.jsx` |
| `src/roles/owner/components/OwnerModule.jsx` | `src/features/owner/components/OwnerModule.jsx` |
| `src/roles/owner/components/AttendanceAdmin.jsx` | `src/features/owner/components/AttendanceAdmin.jsx` |
| `src/roles/employee/components/AttendancePage.jsx` | `src/features/employee/components/AttendancePage.jsx` |

### Stylesheet

| Lokasi sekarang | Lokasi target | Risiko/ketergantungan |
|---|---|---|
| `src/owner.css` | `src/features/owner/styles/owner.css` | Mengandung shell/kelas Owner dan style lama; pertahankan sumber serta urutannya. |
| `src/owner-dashboard.css` | `src/features/owner/styles/owner-dashboard.css` | CSS Owner utama dan override; sangat sensitif terhadap cascade. |
| `src/owner-single-outlet.css` | `src/features/owner/styles/owner-single-outlet.css` | Override layout Owner; import setelah style Owner dasar sesuai urutan sekarang. |
| `src/owner-motion.css` | `src/features/owner/styles/owner-motion.css` | Pastikan selector tetap hanya mengubah Owner dan reduced-motion tetap berlaku. |
| `src/owner-entry.css` | `src/shared/styles/entry.css` | Digunakan Owner/halaman entry, Employee, dan gerbang shift Kasir; bukan stylesheet Owner eksklusif. |
| `src/typography.css` | `src/shared/styles/typography.css` | Tipografi lintas aplikasi. |
| `src/roles/cashier/cashier-redesign.css` | `src/features/cashier/styles/cashier-redesign.css` | Tetap dimuat setelah stylesheet lama agar redesign tidak berubah. |
| `src/pages.css` | `src/features/cashier/styles/pages.css` | Bagian dari kelompok CSS Kasir; verifikasi penggunaan lintas role sebelum pemindahan. |
| `src/history.css` | `src/features/cashier/styles/history.css` | Gaya riwayat Kasir. |
| `src/operations.css` | `src/features/cashier/styles/operations.css` | Gaya halaman operasional Kasir. |
| `src/reports.css` | `src/features/cashier/styles/reports.css` | Gaya laporan Kasir. |
| `src/style.css` | `src/style.css` untuk tahap awal | Tetap di tempat karena memuat `@import "tailwindcss"` serta aturan dasar/layar yang luas. Jangan memindah atau memecahnya sebelum audit selector dan efek lintas role. |

### File yang sebaiknya tetap di lokasi sekarang

| File/folder | Alasan |
|---|---|
| `index.html` | Entry dokumen Vite tetap di root dan menunjuk `/src/main.jsx`. |
| `vite.config.js` | Konfigurasi Vite root dan proxy `/api`; tidak perlu folder `config/` untuk satu konfigurasi ini. |
| `package.json`, `package-lock.json` | Manifest dan lockfile harus tetap berpasangan di root; tidak ada dependency yang diminta. |
| `.env`, `.env.example` | Backend mengharapkan `.env` dari root proyek; file rahasia aktual tidak boleh dipindah/dicatat dalam dokumen. |
| `api/`, `database/` | Batas backend/database sudah jelas dan dipakai oleh perintah PHP/SQL di README. Jangan menerapkan pola folder React pada PHP. |
| `api/public/index.php`, `api/bootstrap.php`, `api/scripts/*` | Front controller, bootstrap, serta script PHP; lokasi saling terkait dengan path `dirname()` dan perintah server. |
| `database/schema.sql`, `database/seed.sql` | Sumber skema dan seed; tidak ada perubahan schema pada tugas restrukturisasi frontend. |
| `docs/`, `PROGRESS.md`, `README-backend.md` | Tetap di lokasi dokumentasi; perbarui referensi path setelah migrasi disetujui. |
| `.agents/` | Instruksi/skill lokal coding agent; tidak termasuk kode aplikasi atau konfigurasi runtime. |
| `node_modules/`, `dist/` | Generated; bukan sumber migrasi. `dist/` dibangun ulang oleh Vite. |

## 6. Risiko dan mitigasi

### Import dan path

- Memindahkan modul mengubah banyak relative import (`../../lib/api`, `./components/...`). Perbarui semua pemakai berdasarkan import graph, bukan hanya import di file yang dipindah.
- Jangan mengandalkan resolver Windows yang kadang tidak menampakkan perbedaan huruf besar/kecil. Samakan kapitalisasi nama file dan import persis, lalu validasi build Linux atau CI Linux.
- Tidak ada alias path yang terlihat pada Vite saat ini. Hindari menambahkan alias/dependency sebagai bagian dari migrasi ini.

### Routing dan state

- Tidak ada konfigurasi router yang perlu dipindahkan. `main.jsx` mengatur pemeriksaan sesi dan pemilihan role; shell Kasir/Owner mengatur menu.
- Pemindahan file saja seharusnya tidak mereset state, tetapi mengubah identitas/struktur tree React atau memecah shell dapat me-remount halaman. Jangan mengubah struktur komponen/state dalam migrasi path.
- Pastikan role Owner, Kasir, dan Karyawan masih masuk ke shell yang sama; keranjang, modal pembayaran, tema, filter, dan form tidak boleh hilang akibat navigasi.

### CSS dan UI

- Urutan impor di `main.jsx` menentukan cascade. Pindahkan satu kelompok stylesheet per tahap dan pertahankan urutan impor yang ada, termasuk `cashier-redesign.css` yang dimuat belakangan.
- `owner-entry.css` tidak eksklusif untuk Owner. Salah kelompok akan berdampak pada layar absensi dan gerbang buka shift.
- Jangan menggabungkan, memecah, mengubah nama selector, atau memperbaiki desain stylesheet saat memindahkan path.
- Pertahankan `owner-motion.css`, dukungan `prefers-reduced-motion`, Light/Dark Mode, dan CSS scoped `.owner-portal`.
- `style.css` mengimpor Tailwind dan memuat gaya dasar luas; memindahkannya dapat mengubah pemrosesan Tailwind maupun tampilan lintas role.

### Build, API, dan deployment

- `index.html` harus tetap menemukan entry `/src/main.jsx`; Vite proxy `/api` harus tetap mengarah ke PHP lokal.
- Endpoint `/api/*`, nama environment variables, credentials, base URL relatif frontend, dan urutan autentikasi tidak berubah.
- Perintah PHP pada README memakai `api/public` sebagai document root dan `api/public/index.php` sebagai front controller. Jangan memindahkan backend atau memutus referensi path ini.
- Update path dalam `README-backend.md`, `docs/architecture-and-flows.md`, `docs/OWNER_DESIGN_MAPPING.md`, `docs/UI_UX_AUDIT.md`, dan dokumen lain yang merujuk `src/roles`, `src/shared/components`, `src/lib`, atau stylesheet.
- Tidak ditemukan asset lokal; referensi font Google Fonts di `index.html` tidak berubah.

## 7. Urutan migrasi bertahap

Urutan berikut digunakan untuk migrasi. Pemindahan file tidak digabungkan dengan refactor logika, perubahan UI, perbaikan data mock, atau perubahan API.

1. **Persiapan dan baseline**
   - Pastikan pengguna menyetujui peta ini dan tidak ada perubahan kerja lain yang perlu dipertahankan.
   - Karena `.git` tidak ditemukan pada audit, siapkan backup/restore point yang dapat dipulihkan sebelum memindahkan file. Jangan menganggap `git status` atau `git mv` tersedia.
   - Jalankan build baseline dan catat hasilnya.
2. **Ekstrak root aplikasi**
   - Pindahkan fungsi `Root` dari `main.jsx` ke `app/Root.jsx`; `main.jsx` tetap entry dan memuat CSS.
   - Perbarui import dan uji login/session, serta pemilihan role. Tidak mengubah perilaku root.
3. **Pindahkan auth dan utilitas bersama**
   - Pindahkan `LoginPage.jsx` dan `lib/api.js` ke lokasi target; perbarui seluruh import.
   - Pastikan CSRF, login, logout, `/api/auth/me`, cookie, dan error tetap berperilaku sama.
4. **Pindahkan fitur Kasir**
   - Pindahkan shell, seluruh komponen/data Kasir, dan stylesheet redesign sebagai satu kelompok.
   - Verifikasi buka shift, katalog, tambah/ubah keranjang, pembayaran, logout, navigasi menu, dan semua layar Kasir.
5. **Pindahkan fitur Owner dan Karyawan**
   - Pindahkan seluruh komponen Owner dan halaman Karyawan.
   - Uji semua menu Owner, dashboard/filter, laporan, form tarif/pengaturan, attendance, tema, dan logout.
6. **Pindahkan stylesheet berkelompok**
   - Pindahkan stylesheet Owner, Kasir, shared entry, dan tipografi tanpa mengubah isi; sesuaikan import di `main.jsx` dan `AttendancePage`.
   - Pertahankan urutan cascade lama. `style.css` tetap di tempat pada tahap ini.
7. **Dokumentasi dan validasi akhir**
   - Perbarui seluruh referensi path dalam dokumentasi dan README; jangan mencantumkan `.env` aktual.
   - Cari import/path lama yang tersisa, jalankan build produksi, smoke test browser lintas role, dan validasi path pada Linux/CI.

## 8. Cara menguji tiap tahap

Belum ada test runner proyek di `package.json`. Gunakan validasi berikut; jangan menyamakan build sukses dengan validasi seluruh perilaku:

| Tahap | Pemeriksaan minimum |
|---|---|
| Baseline | `npm run build`; bila backend tersedia, jalankan sesuai README dan catat hasil login. |
| Root/auth/shared API | Build; login gagal/berhasil, pemulihan sesi, logout, redirect role Owner/Kasir/Karyawan, request CSRF. |
| Kasir | Build; role Kasir, gerbang buka shift, kategori/katalog, keranjang dan total, modal pembayaran, submit transaksi, perpindahan seluruh menu, tema. Gunakan backend uji yang aman untuk transaksi. |
| Owner/Karyawan | Build; dashboard dan perubahan filter, laporan, halaman absensi, ubah tarif/outlet pada lingkungan uji, tema terang/gelap, logout. |
| CSS | Periksa layout desktop/tablet/ponsel dan Light/Dark Mode; pastikan motion Owner serta reduced motion masih berlaku dan style entry Kasir/Karyawan tidak berubah. |
| Akhir/deployment | Build bersih, pencarian import/path lama, jalankan pada Linux/CI untuk menemukan kapitalisasi yang tidak cocok; lakukan smoke test `/api` melalui Vite proxy dan PHP front controller. |

Jika PHP/PostgreSQL atau browser test tidak tersedia pada suatu tahap, tandai pemeriksaan tersebut belum dilakukan; jangan mengklaim hasilnya dari build saja.

### Hasil validasi aktual

- `npm.cmd run build`: berhasil setelah perpindahan file dan pembaruan import.
- Smoke test browser dengan API mock sementara: navigasi enam halaman Owner, pemuatan POS Kasir, keranjang tetap terisi setelah berpindah Dashboard lalu kembali ke Transaksi Baru, serta alur tampilan check-in Karyawan berhasil.
- Verifikasi Owner setelah CSS dipindahkan: entrance content 220ms, kartu 260ms, grafik 650ms; header tetap tanpa animasi dan reduced motion menonaktifkan animasi.
- Tidak ada uncaught JavaScript exception dalam smoke test akhir. Pemeriksaan browser memakai API mock; koneksi database/API produksi tidak diuji.

## 9. Strategi rollback

1. Buat restore point sebelum langkah pertama. Saat ini direktori bukan repository Git yang dapat diverifikasi, jadi jangan mengandalkan revert/checkout Git.
2. Migrasikan per kelompok. Catat pasangan path lama/baru dan pertahankan isi file identik; jangan menghapus salinan sumber sampai build dan smoke test kelompok tersebut lulus.
3. Jika tahap gagal, pulihkan file kelompok yang terakhir dipindah ke path asal dan kembalikan import/entry yang berubah pada tahap itu saja.
4. Jalankan kembali `npm run build` dan smoke test terakhir yang diketahui lulus sebelum melanjutkan.
5. Jika pengguna menyediakan repository Git atau restore point terkelola sebelum implementasi, gunakan mekanisme tersebut untuk perubahan yang memang dibuat dalam sesi migrasi. Jangan membuang perubahan yang sudah ada sebelumnya.

## Hasil dan rekomendasi

Migrasi ke `src/features/{auth,cashier,owner,employee}` dengan `src/shared` untuk klien API dan stylesheet bersama telah diterapkan. `src/main.jsx`, root `index.html`, konfigurasi Vite, `.env`, serta folder backend/database dipertahankan. Isi stylesheet tidak diubah dan `style.css` tetap di tempat. Build produksi serta smoke test browser Owner, Kasir, dan Karyawan berhasil dengan API mock.
