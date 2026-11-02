import React, { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, CircleHelp, Search, ShoppingCart, Coins, CreditCard, Shirt } from 'lucide-react'

const guides = [
  { category: 'Transaksi', question: 'Bagaimana cara membuat transaksi Self Service?', answer: 'Pilih Transaksi Baru, buka kategori Self Service, lalu pilih layanan. Buka Detail & pembayaran untuk mengisi berat tiap layanan dan memeriksa total berat serta jumlah mesin sebelum menyimpan transaksi. Setelah berhasil, struk dapat dicetak dari konfirmasi transaksi.' },
  { category: 'Transaksi', question: 'Bagaimana harga malam dihitung?', answer: 'Harga malam berlaku pukul 23.00 sampai 05.59 WIB untuk Self Service Cuci + Kering dan Drop Off Cuci + Kering. Tema terang atau gelap tidak mengubah harga.' },
  { category: 'Pembayaran', question: 'Apa yang terjadi jika Drop Off belum dibayar?', answer: 'Pesanan tetap berstatus Belum Bayar. Nilai tagihan tidak dihitung sebagai uang diterima sampai pembayaran dicatat.' },
  { category: 'Pesanan', question: 'Bagaimana cara memperbarui status pesanan?', answer: 'Buka Pesanan Laundry, pilih pesanan untuk melihat detail, lalu gunakan tombol Perbarui status. Pada prototipe, perubahan hanya berlaku selama sesi browser.' },
  { category: 'Koin', question: 'Apa perbedaan Koin Reguler dan Extra Dry?', answer: 'Koin Reguler digunakan pada mesin cuci selama 30 menit atau pengering selama 45 menit. Koin Extra Dry menambah waktu pengeringan 20 menit.' },
  { category: 'Stok', question: 'Bagaimana mencatat stok masuk?', answer: 'Buka Produk & Stok, pilih Atur stok pada produk, kemudian pilih Tambah stok dan masukkan jumlah. Perubahan pada prototipe tidak tersimpan ke database.' },
]

export default function HelpPage() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(guides[0].question)
  const filtered = useMemo(() => guides.filter(item => `${item.category} ${item.question} ${item.answer}`.toLowerCase().includes(query.toLowerCase())), [query])
  return <div className="page-stack help-page">
    <section className="help-hero"><div className="help-hero-icon"><CircleHelp size={27}/></div><div><div className="eyebrow">PUSAT PANDUAN KINO</div><h2>Ada yang bisa kami bantu?</h2><p>Temukan panduan singkat tentang transaksi, pembayaran, pesanan, dan stok.</p></div><label className="help-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari panduan..."/></label></section>
    <div className="help-category-grid">{[[ShoppingCart, 'Transaksi', 'Layanan dan checkout'], [CreditCard, 'Pembayaran', 'Tunai, QRIS, dan tagihan'], [Shirt, 'Pesanan', 'Status cucian pelanggan'], [Coins, 'Koin & stok', 'Catatan operasional']].map(([Icon, title, desc]) => <button key={title} className="help-category" onClick={() => setQuery(title === 'Koin & stok' ? 'koin' : title)}><span><Icon size={17}/></span><b>{title}</b><small>{desc}</small></button>)}</div>
    <section className="help-articles panel"><div className="panel-heading"><div><h3><BookOpen size={16}/> Panduan yang sering dibuka</h3><p>Informasi penggunaan prototipe KINO Laundry POS.</p></div><span className="help-count">{filtered.length} panduan</span></div>{filtered.length ? <div className="help-accordion">{filtered.map(item => <article className={`help-item ${open === item.question ? 'expanded' : ''}`} key={item.question}><button onClick={() => setOpen(open === item.question ? '' : item.question)}><span><small>{item.category}</small><b>{item.question}</b></span><ChevronDown size={17}/></button>{open === item.question && <p>{item.answer}</p>}</article>)}</div> : <div className="help-empty">Panduan tidak ditemukan. Coba kata kunci lain.</div>}</section>
    <div className="help-prototype-note"><CircleHelp size={15}/><span><b>Butuh bantuan lebih lanjut?</b> Pusat bantuan langsung belum dihubungkan pada prototipe ini.</span></div>
  </div>
}
