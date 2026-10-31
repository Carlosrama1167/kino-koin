import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronDown, Clock3, CreditCard, Download, FileText, Printer, ReceiptText, Search, Wallet, WashingMachine, X } from 'lucide-react'
import { api } from '../../../shared/api'

const money = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
const dateLabel = (date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T12:00:00+07:00`))
const periods = ['Hari Ini', '7 Hari Terakhir', 'Bulan Ini', 'Kustom']
const todayJakarta = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const previousDate = (date, days) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10)
}

export default function TransactionHistory({ notify }) {
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('Hari Ini')
  const today = todayJakarta()
  const [customFrom, setCustomFrom] = useState(() => previousDate(todayJakarta(), 6))
  const [customTo, setCustomTo] = useState(today)
  const [appliedRange, setAppliedRange] = useState(null)
  const [method, setMethod] = useState('Semua metode')
  const [category, setCategory] = useState('Semua kategori')
  const [status, setStatus] = useState('Semua status')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [settlementMethod, setSettlementMethod] = useState('qris')
  const [settlementCash, setSettlementCash] = useState('')
  const dateRange = useMemo(() => {
    if (period === 'Kustom') return appliedRange
    if (period === 'Hari Ini') return { from: todayJakarta(), to: todayJakarta() }
    if (period === '7 Hari Terakhir') return { from: previousDate(todayJakarta(), 6), to: todayJakarta() }
    const todayDate = todayJakarta()
    return { from: `${todayDate.slice(0, 7)}-01`, to: todayDate }
  }, [period, appliedRange])
  const requestQuery = useMemo(() => {
    if (!dateRange) return ''
    const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to, page: String(page), limit: '50' })
    params.set('refresh', String(refreshVersion))
    if (query.trim()) params.set('search', query.trim())
    if (method !== 'Semua metode') params.set('payment_method', method.toLowerCase())
    if (category !== 'Semua kategori') params.set('category', category)
    if (status !== 'Semua status') params.set('payment_status', status === 'Lunas' ? 'lunas' : 'belum_bayar')
    return params.toString()
  }, [dateRange, page, query, method, category, status, refreshVersion])
  const list = data?.items || []
  useEffect(() => {
    if (!requestQuery) { setLoading(false); setData(null); setSelected(null); setError(''); return undefined }
    let active = true
    setLoading(true)
    setError('')
    api(`/api/transactions?${requestQuery}`)
      .then(result => { if (active) setData({ ...result, items: result.items.map(mapTransaction) }) })
      .catch(reason => { if (active) { setData(null); setError(reason.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [requestQuery])
  useEffect(() => {
    const current = list.find(tx => tx.id === selected?.id)
    if (!current) setSelected(list[0] || null)
    else if (current !== selected) setSelected(current)
  }, [list, selected?.id])
  useEffect(() => {
    setSettlementMethod(selected?.method === 'Tunai' ? 'tunai' : 'qris')
    setSettlementCash('')
  }, [selected?.id, selected?.method])
  const visibleValue = Number(data?.summary?.transaction_value || 0)
  const received = Number(data?.summary?.received || 0)
  const unpaid = Number(data?.summary?.unpaid_count || 0)
  const pick = (tx) => setSelected(tx)
  const settlePayment = async () => {
    if (!selected) return
    if (settlementMethod === 'qris' && !window.confirm('Pastikan dana QRIS telah masuk sebelum mengonfirmasi pembayaran secara manual.')) return
    setConfirming(true)
    setError('')
    try {
      await api(`/api/transactions/${selected.recordId}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({
          payment_method: settlementMethod,
          ...(settlementMethod === 'tunai' ? { cash_received: Number(settlementCash || 0) } : {}),
        }),
      })
      notify(settlementMethod === 'qris' ? 'Pembayaran QRIS dicatat sebagai konfirmasi manual kasir.' : 'Pembayaran tunai berhasil dicatat.')
      setRefreshVersion(value => value + 1)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setConfirming(false)
    }
  }
  const applyRange = () => {
    if (!customFrom || !customTo || customFrom > customTo) { setError('Rentang tanggal tidak valid.'); return }
    setPage(1)
    setAppliedRange({ from: customFrom, to: customTo })
  }
  const exportNotice = (format) => notify(`Ekspor ${format} belum tersedia untuk data transaksi aktual.`)

  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 50)))
  const firstItem = data?.total ? (page - 1) * (data?.limit || 50) + 1 : 0
  const lastItem = Math.min(page * (data?.limit || 50), data?.total || 0)

  return <div className="page-stack history-page">
    <div className="history-hero"><div><div className="eyebrow"><ReceiptText size={14}/> AUDIT PEMBAYARAN & POS</div><h2>Riwayat Transaksi & Pembayaran</h2><p>Telusuri transaksi aktual, status pembayaran, dan rincian nota.</p></div><div className="history-actions"><button className="btn btn-secondary" onClick={() => exportNotice('Excel')}><Download size={15}/> Export Excel</button><button className="btn btn-secondary" onClick={() => exportNotice('PDF')}><FileText size={15}/> Export PDF</button><button className="btn btn-primary" onClick={() => notify('Rekap shift tersedia di halaman laporan.') }><Printer size={16}/> Cetak rekap shift</button></div></div>
    <div className="history-metrics"><HistoryMetric icon={Wallet} tone="blue" label="Nilai transaksi" value={money(visibleValue)} foot={`${data?.total || 0} transaksi pada filter ini`}/><HistoryMetric icon={Check} tone="green" label="Pembayaran diterima" value={money(received)} foot="Nominal pembayaran tercatat"/><HistoryMetric icon={Clock3} tone="orange" label="Belum dibayar" value={`${unpaid} nota`} foot="Tidak dihitung sebagai penerimaan"/><HistoryMetric icon={ReceiptText} tone="cyan" label="Rata-rata per nota" value={data?.total ? money(Math.round(visibleValue / data.total)) : money(0)} foot="Berdasarkan transaksi terfilter"/></div>
    <section className="history-filter-panel">
      <div className="history-filter-top"><label className="history-search"><Search size={18}/><input value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Cari ID nota, nama pelanggan, atau nomor HP..."/>{query && <button onClick={() => { setQuery(''); setPage(1) }} aria-label="Hapus pencarian"><X size={15}/></button>}</label><div className="period-pills">{periods.map(item => <button key={item} className={period === item ? 'selected' : ''} onClick={() => { setPeriod(item); setPage(1) }}>{item === 'Kustom' && <CalendarDays size={14} />}{item}</button>)}</div></div>
      {period === 'Kustom' && <div className="custom-date-row"><label>Dari tanggal<input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}/></label><label>Sampai tanggal<input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}/></label><button className="btn btn-primary" onClick={applyRange}>Terapkan tanggal</button></div>}
      <div className="history-selects"><FilterSelect label="Metode bayar" value={method} onChange={value => { setMethod(value); setPage(1) }} options={['Semua metode', 'Tunai', 'QRIS']}/><FilterSelect label="Tipe layanan" value={category} onChange={value => { setCategory(value); setPage(1) }} options={['Semua kategori', 'Self Service', 'Drop Off', 'Cuci Kering Setrika', 'Setrika Saja', 'Produk & Minuman']}/><FilterSelect label="Status pembayaran" value={status} onChange={value => { setStatus(value); setPage(1) }} options={['Semua status', 'Lunas', 'Belum Bayar']}/></div>
    </section>
    {error && <div className="checkout-error" role="alert">{error}</div>}
    <div className="history-content-grid"><section className="history-table-card">
      <div className="history-table-heading"><div><h3>Daftar transaksi</h3><span>{loading ? 'Memuat data…' : `${data?.total || 0} transaksi ditemukan`}</span></div><div className="sync-status"><i/>{loading ? 'Mengambil data' : 'Data aktual'}</div></div>
      <div className="history-table-scroll"><table className="history-table"><thead><tr><th>Nota & waktu</th><th>Pelanggan</th><th>Rincian layanan</th><th className="align-right">Nominal</th><th>Metode</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{list.map(tx => <tr key={tx.id} className={selected?.id === tx.id ? 'is-selected' : ''} onClick={() => pick(tx)}><td><b className="history-id">{tx.id}</b><small><Clock3 size={11}/>{tx.time} WIB · {dateLabel(tx.date)}</small></td><td><b>{tx.customer}</b><small>{tx.phone || '—'}</small></td><td><b>{tx.items}</b><small>{tx.detail}</small></td><td className="align-right"><b className="history-amount">{money(tx.total)}</b><small>{tx.paymentStatus === 'Lunas' ? tx.change ? `Kembalian ${money(tx.change)}` : 'Pembayaran diterima' : 'Belum ada penerimaan'}</small></td><td><span className={`method-chip ${tx.method.toLowerCase().replaceAll(' ', '-')}`}>{tx.method === 'QRIS' ? <CreditCard size={13}/> : <Wallet size={13}/>} {tx.method}</span></td><td><span className={`history-status ${tx.paymentStatus === 'Lunas' ? 'settled' : 'pending'}`}><i/>{tx.paymentStatus}</span></td><td><button className={`history-action ${selected?.id === tx.id ? 'active' : ''}`} onClick={e => { e.stopPropagation(); pick(tx) }} aria-label="Lihat nota" aria-pressed={selected?.id === tx.id}><ReceiptText size={15}/><span>Nota</span></button></td></tr>)}</tbody></table>
        {!loading && !error && !list.length && <div className="history-empty"><Search size={22}/><b>Transaksi tidak ditemukan</b><span>Coba ubah kata kunci atau filter.</span></div>}
        {loading && <div className="history-empty">Memuat transaksi aktual…</div>}
      </div>
      <div className="history-table-footer"><span>Menampilkan <b>{firstItem}–{lastItem}</b> dari <b>{data?.total || 0}</b> transaksi</span><div><button disabled={page<=1 || loading} onClick={() => setPage(current => current-1)}>‹</button><button className="page-active">{page}</button><button disabled={page>=pages || loading} onClick={() => setPage(current => current+1)}>›</button></div></div>
    </section>
      <aside className="receipt-preview"><div className="receipt-preview-head"><div><div className="receipt-heading-icon"><ReceiptText size={17}/></div><span><b>Pratinjau nota</b><small>{selected?.id || 'Pilih transaksi'}</small></span></div><button className="icon-button" onClick={() => notify('Cetak struk belum dikonfigurasi.')} aria-label="Cetak ulang"><Printer size={16}/></button></div>{selected ? <><div className="thermal-paper"><div className="receipt-brand-mark"><WashingMachine size={19}/></div><b className="receipt-brand">KINO LAUNDRY</b><small className="receipt-tagline">Bersih, wangi, setiap hari</small><div className="receipt-dash"/><div className="receipt-meta"><div><span>No. Nota</span><b>{selected.id}</b></div><div><span>Tanggal</span><b>{dateLabel(selected.date)} · {selected.time}</b></div><div><span>Kasir</span><b>{selected.cashier}</b></div><div><span>Pelanggan</span><b>{selected.customer}</b></div></div><div className="receipt-dash"/><div className="receipt-line-item"><span>{selected.items}</span><b>{money(selected.total)}</b></div><small className="receipt-line-detail">{selected.detail}</small><div className="receipt-dash"/><div className="receipt-total"><span>Subtotal</span><b>{money(selected.subtotal)}</b></div>{selected.deliveryFee > 0 && <div className="receipt-pay-info"><span>Ongkir</span><b>{money(selected.deliveryFee)}</b></div>}{selected.discountAmount > 0 && <div className="receipt-pay-info"><span>Diskon</span><b>− {money(selected.discountAmount)}</b></div>}<div className="receipt-total"><span>Total</span><b>{money(selected.total)}</b></div><div className="receipt-pay-info"><span>Metode pembayaran</span><b>{selected.method}</b></div><div className="receipt-pay-info"><span>Status pembayaran</span><b className={selected.paymentStatus === 'Lunas' ? 'receipt-paid' : 'receipt-pending'}>{selected.paymentStatus}</b></div>{selected.method === 'Tunai' && selected.paymentStatus === 'Lunas' && <><div className="receipt-pay-info"><span>Uang diterima</span><b>{money(selected.tendered)}</b></div><div className="receipt-pay-info"><span>Kembalian</span><b>{money(selected.change)}</b></div></>}<div className="receipt-dash"/>{selected.notes && <small className="receipt-line-detail">Catatan: {selected.notes}</small>}<p className="receipt-thanks">Terima kasih telah menggunakan KINO Laundry.</p></div><button className="btn btn-primary receipt-print" onClick={() => notify('Cetak struk belum dikonfigurasi.')}><Printer size={16}/> Cetak ulang struk</button><div className="receipt-hint">Pratinjau transaksi tersimpan · Tidak mengirim ke printer</div></> : <div className="receipt-no-selection">Pilih transaksi untuk melihat pratinjau nota.</div>}</aside></div>
    {selected?.paymentStatus === 'Belum Bayar' && <div className="history-footnote"><Wallet size={14}/>{selected.method === 'QRIS' ? 'Pastikan dana QRIS telah masuk; pencatatan ini adalah konfirmasi manual kasir, bukan verifikasi provider.' : 'Pilih metode pembayaran dan catat penerimaan saat dana diterima.'}{selected.method === 'Belum dipilih' && <select value={settlementMethod} onChange={event => setSettlementMethod(event.target.value)} aria-label="Metode pelunasan"><option value="tunai">Tunai</option><option value="qris">QRIS</option></select>}{settlementMethod === 'tunai' && <input type="number" min={selected.total} step="0.01" value={settlementCash} onChange={event => setSettlementCash(event.target.value)} placeholder="Uang diterima" aria-label="Uang tunai diterima"/>}<button className="btn btn-primary" onClick={settlePayment} disabled={confirming || (settlementMethod === 'tunai' && Number(settlementCash || 0) < selected.total)}>{confirming ? 'Mencatat…' : settlementMethod === 'qris' ? 'Konfirmasi QRIS manual' : 'Catat pembayaran tunai'}</button></div>}
    {selected?.manualConfirmation && <div className="history-footnote"><Wallet size={14}/> Pembayaran QRIS tercatat melalui konfirmasi manual kasir, bukan verifikasi otomatis provider.</div>}
    <div className="history-footnote"><Wallet size={14}/> Nilai “Pembayaran diterima” hanya menghitung pembayaran yang tercatat. Tagihan belum dibayar tidak dihitung sebagai penerimaan.</div>
  </div>
}

function mapTransaction(row) {
  const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || []
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.created_at))
  const time = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(row.created_at))
  const category = items.find(item => item.category)?.category || (row.transaction_type === 'product' ? 'Produk & Minuman' : row.transaction_type === 'drop_off' ? 'Drop Off' : row.transaction_type === 'laundry' ? 'Cuci Kering Setrika' : 'Self Service')
  const method = row.payment_method === 'tunai' ? 'Tunai' : row.payment_method === 'qris' ? 'QRIS' : 'Belum dipilih'
  const machineDetails = []
  if (Number(row.washer_machine_count) > 0) machineDetails.push(`${row.washer_machine_count} mesin cuci`)
  if (Number(row.dryer_machine_count) > 0) machineDetails.push(`${row.dryer_machine_count} pengering`)
  return {
    id: row.transaction_number,
    recordId: row.id,
    date,
    time,
    cashier: row.cashier || '—',
    customer: row.customer || 'Pelanggan umum',
    phone: row.phone || '',
    items: items.map(item => item.description).join(', ') || '—',
    detail: [items.map(item => `${Number(item.quantity)} × ${money(Number(item.unit_price))}`).join(' · '), machineDetails.join(' · ')].filter(Boolean).join(' · '),
    category,
    total: Number(row.total),
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    discountAmount: Number(row.discount_amount),
    tendered: Number(row.cash_received),
    change: Number(row.change_amount),
    manualConfirmation: row.confirmation_method === 'manual',
    method,
    paymentStatus: row.payment_status === 'lunas' ? 'Lunas' : 'Belum Bayar',
    notes: row.notes || '',
  }
}

function HistoryMetric({ icon: Icon, tone, label, value, foot }) { return <div className="history-metric"><div className={`history-metric-icon ${tone}`}><Icon size={19}/></div><small>{label}</small><b>{value}</b><span>{foot}</span></div> }
function FilterSelect({ label, value, options, onChange }) { return <label className="history-filter-select"><span>{label}</span><div><select value={value} onChange={e => onChange(e.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select><ChevronDown size={15}/></div></label> }
