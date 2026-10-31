# Panduan UI/UX Clean Minimalist POS

Pedoman ini adalah target desain untuk tahap redesign berikutnya, bukan perubahan kode. Fokusnya layar sentuh tablet landscape untuk operasional 24 jam, dengan dukungan desktop dan ponsel.

## Prinsip utama

1. **Satu tujuan utama per layar.** POS melayani transaksi; dashboard memberi ringkasan; halaman operasional membantu mencari/memperbarui satu hal.
2. **Tindakan lebih menonjol daripada dekorasi.** Gunakan satu tombol utama per konteks, tombol sekunder seperlunya, dan hindari status palsu/dekoratif.
3. **Data harus dapat dipercaya.** Bedakan data database dari prototipe. Jangan menampilkan angka mock sebagai angka toko aktif.
4. **Informasi bertingkat.** Tampilkan ringkasan yang membantu keputusan; pindahkan rincian, keterangan teknis, dan konfigurasi jarang ke detail/drawer/pengaturan.
5. **Tidak menghapus kemampuan.** Fitur yang tidak cocok tampil terus-menerus dapat dipindah atau disembunyikan dari tampilan utama; aksesnya tetap dipertahankan.

## Layout dan prioritas layar

### POS Kasir

- **Landscape/tablet:** sidebar ringkas, area pemilihan layanan/produk, serta keranjang dengan total dan tombol bayar yang tetap terlihat. Beri keranjang sekitar sepertiga lebar konten; jangan mengorbankan keterbacaan kartu layanan demi mempertahankan empat KPI.
- **Portrait/tablet kecil:** katalog satu kolom/dua kolom sesuai lebar; keranjang menjadi drawer atau bottom sheet dengan tombol total yang selalu terlihat.
- Kategori layanan berupa tab/tombol singkat dan dapat digulir horizontal. Tampilkan layanan sebagai pilihan sederhana berisi nama, harga/satuan, dan durasi/catatan relevan. Hindari ikon berwarna berbeda untuk setiap kartu.
- Form pelanggan hanya muncul saat tipe layanan memerlukannya. Self Service tidak meminta data yang tidak diperlukan. Untuk Drop Off, tampilkan field yang benar-benar disimpan dan digunakan. Penyelarasan field dengan API merupakan prasyarat implementasi UI; audit ini tidak mengusulkan perubahan backend.
- Pembayaran adalah langkah terpisah dengan total utama, metode, input uang tunai/kembalian, dan konfirmasi. Jangan menyebut QRIS terverifikasi atau menampilkan kode pembayaran sungguhan sebelum provider diintegrasikan.

### Halaman informasi

- Dashboard: satu indikator utama dan beberapa ringkasan operasional yang dapat ditindaklanjuti; hindari beberapa panel yang menyampaikan angka sama.
- Daftar operasional: pencarian/filter sederhana di atas; daftar yang dapat dipindai; detail dan tindakan di drawer.
- Laporan: periode + filter dasar, ringkasan keuangan, lalu tabel/ekspor. Tandai batas hasil atau data contoh tanpa menyembunyikan batasan penting.
- Pengaturan: pisahkan pengaturan profil bisnis, preferensi lokal, dan perangkat. Jangan gabungkan kontrol yang tidak menyimpan dengan tombol “Simpan” seolah-olah persist.

## Design tokens yang direkomendasikan

Gunakan token CSS yang konsisten di seluruh role. Nilai berikut adalah rekomendasi awal; periksa kontras dan tampilan aktual sebelum menetapkannya.

| Token | Light | Dark | Penggunaan |
|---|---|---|---|
| `--color-bg` | `#F5F7FA` | `#0E1521` | Latar aplikasi |
| `--color-surface` | `#FFFFFF` | `#172233` | Panel/form/dialog |
| `--color-surface-subtle` | `#EDF1F6` | `#1D2B3F` | Hover, baris tabel, filter |
| `--color-text` | `#182230` | `#F0F4FA` | Teks utama |
| `--color-muted` | `#526174` | `#A8B5C7` | Teks sekunder; tetap terbaca |
| `--color-border` | `#D8E0EA` | `#33445B` | Pembatas dan input |
| `--color-primary` | `#1769D2` | `#75AEFF` | Aksi utama, link, fokus |
| `--color-success` | `#19724A` | `#62D09A` | Berhasil/lunas |
| `--color-warning` | `#8A5A08` | `#F0BE5B` | Perhatian/menunggu |
| `--color-danger` | `#B42332` | `#FF8791` | Gagal/batal |

- Maksimal satu warna brand dominan pada satu layar. Warna status digunakan hanya untuk status dan selalu disertai label/ikon.
- Target kontras WCAG AA: minimal 4.5:1 untuk teks normal dan 3:1 untuk teks besar/komponen visual penting. Verifikasi setiap pasangan warna Light dan Dark.
- Jangan gunakan warna tema untuk menentukan harga malam. Mode tampilan dan aturan harga adalah dua keadaan terpisah.

## Tipografi

Gunakan **Inter** untuk teks antarmuka dan tabel, **Plus Jakarta Sans** untuk judul utama/section, tanpa font ketiga.

| Elemen | Ukuran / weight |
|---|---:|
| Judul halaman | 24px / 700 |
| Judul section | 18px / 600 |
| Judul card/panel | 16px / 600 |
| Body | 14px / 400 |
| Label input | 13px / 500 |
| Tombol utama | 14–16px / 600 |
| Harga layanan | 18px / 700 |
| Total checkout | 28–32px / 700 |
| Tabel | 14px / 400–500 |
| Caption | 12px / 400 |

Caption tidak boleh turun ke ukuran yang sulit dibaca untuk informasi operasional; gunakan 12px sebagai batas minimum rekomendasi, bukan 6–10px yang muncul di sebagian CSS saat ini. Pertahankan line-height yang nyaman dan jangan mengecilkan teks pada tablet.

## Spacing, bentuk, dan kedalaman

- Skala spacing dasar: `4, 8, 12, 16, 24, 32px`; gunakan kelipatannya agar jarak konsisten.
- Radius: 6–8px untuk kontrol; 10–12px untuk panel/dialog. Hindari panel bertumpuk di dalam panel tanpa kebutuhan.
- Border tipis menjadi pemisah utama. Gunakan bayangan sangat ringan hanya untuk drawer/dialog atau komponen yang mengambang.
- Ikon mendukung label, bukan menggantikan label untuk tindakan penting. Hindari gradient, dekorasi abstrak, serta palet ikon yang tidak bermakna.
- Batasi kontainer/card: satu panel untuk satu kelompok tugas. Tidak perlu membungkus setiap metrik atau baris informasi dengan card tersendiri.

## Komponen dan interaksi

### Tombol dan sentuhan

- Target sentuh minimal **44×44px** untuk kontrol utama dan navigasi; gunakan jarak cukup agar kontrol tidak berdekatan.
- Tombol bayar/konfirmasi minimal 48px tinggi dan memiliki label tindakan yang spesifik.
- Bedakan primary, secondary, destructive, dan text action secara visual. Maksimal satu primary action dominan per panel.
- Sediakan state default, hover, pressed, disabled, loading, sukses, dan error. Jangan hanya mengandalkan perubahan warna.
- Ikon-only hanya untuk tindakan yang jelas, diberi `aria-label`, dan target sentuh tetap memenuhi ukuran.

### Input dan filter

- Label selalu terlihat, bukan hanya placeholder. Sediakan error dekat field yang terkait.
- Tinggi input/tombol filter setidaknya 44px di mode tablet.
- Tampilkan filter utama; filter jarang dapat diletakkan pada tombol “Filter lainnya” yang membuka panel.
- Rentang tanggal dan filter tetap memiliki nilai yang terlihat setelah diterapkan.

### Daftar dan tabel

- Dahulukan daftar responsif pada tablet; tampilkan kolom prioritas (ID/nama, status, total, tindakan).
- Pindahkan atribut sekunder ke detail. Bila tabel perlu digeser horizontal, tampilkan affordance dan jangan memerlukan banyak scroll horizontal untuk data inti.
- Gunakan tinggi baris setidaknya 48px pada konteks sentuh. Status memiliki teks, bukan warna saja.
- Untuk layar sempit, alihkan baris ke ringkasan bertumpuk dan buka detail melalui drawer.

### Keranjang dan dialog

- Jumlah item, harga satuan, total, dan hapus/ubah kuantitas harus mudah ditemukan.
- Checkout tidak boleh kehilangan total ketika halaman katalog digulir.
- Dialog fokus pada satu keputusan; modal dapat ditutup dengan tombol yang jelas dan menjaga urutan fokus.
- Jangan membuka modal untuk data yang lebih cocok sebagai panel detail; hindari dialog berlapis.

## Light dan Dark Mode

- Gunakan token semantik yang sama untuk seluruh role. Tema mengubah token surface/text/border, tidak mengubah makna status.
- Semua halaman dan komponen turunan harus mewarisi tema: Login, POS, drawer, modal, tabel, form, empty/error state, Absensi, dan Owner.
- Simpan satu pilihan tema konsisten untuk pengalaman pengguna; perubahan pada satu role tidak semestinya membuat role lain memakai palet berbeda tanpa alasan.
- Periksa state focus, selected, disabled, error, warning, badge, placeholder, border, dan dialog di kedua mode. Jangan meninggalkan warna fixed light pada halaman yang berada dalam dark mode.
- Hormati preferensi tema sistem hanya sebagai default opsional; pilihan eksplisit pengguna harus menang.

## Responsif dan aksesibilitas

- Uji minimal pada tablet landscape 1024×768 dan 1280×800, tablet portrait 768×1024, serta ponsel 390×844; juga keyboard-only.
- Pertahankan fokus yang terlihat, heading berurutan, label input eksplisit, nama tombol bermakna, dan `aria-live` untuk error/sukses yang penting.
- Teks normal memenuhi kontras AA. Jangan menggunakan teks kecil, tipis, atau muted untuk instruksi yang dibutuhkan kasir.
- Sediakan loading, kosong, error, offline, dan data prototipe sebagai state yang berbeda dan jelas.
- Hindari mengandalkan tooltip/hover untuk fungsi penting di layar sentuh.

## Konsistensi data dan bahasa

- Gunakan bahasa Indonesia konsisten, termasuk satuan, format waktu Asia/Jakarta, dan format Rupiah.
- Gunakan kata kerja yang langsung: “Tambah ke keranjang”, “Simpan harga”, “Buka shift”, “Konfirmasi tunai”.
- Beri label “Data contoh/prototipe” secara dekat dan terlihat bila sumber data mock; jangan memakai dot hijau atau “live” untuk data mock.
- Sembunyikan dari tampilan utama placeholder tindakan yang belum dapat dijalankan; status/roadmap fitur bisa tetap tersedia di bagian informasi khusus.
