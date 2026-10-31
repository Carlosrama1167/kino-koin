import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, Coins, CreditCard, Printer, Wallet, ReceiptText } from 'lucide-react'
import { api } from '../../../shared/api'
import '../styles/expense-report.css'

const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const dateLabel = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(`${value}T12:00:00+07:00`)) : '—'
const dateTime = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : 'Belum ditutup'
const shiftName = value => value.charAt(0).toUpperCase() + value.slice(1)

export default function ShiftReports({ notify }) {
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [shiftFilter, setShiftFilter] = useState('')
  const [items, setItems] = useState([])
  const [expensesAvailable, setExpensesAvailable] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (shiftFilter) params.set('shift_type', shiftFilter)
    return params.toString()
  }, [from, to, shiftFilter])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api(`/api/shifts/reports?${query}`)
      .then(result => { if (active) { setItems(result.items); setExpensesAvailable(result.expense_ledger_ready) } })
      .catch(reason => { if (active) { setItems([]); setError(reason.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (!items.some(item => item.id === selectedId)) setSelectedId(items[0]?.id || null)
  }, [items, selectedId])

  const selected = items.find(item => item.id === selectedId) || null
  const totals = items.reduce((result, item) => ({
    cash: result.cash + Number(item.cash_total || 0),
    qris: result.qris + Number(item.qris_total || 0),
    expenses: result.expenses + Number(item.expense_total || 0),
    cashExpenses: result.cashExpenses + Number(item.cash_expense_total || 0),
    transactions: result.transactions + Number(item.transaction_count || 0),
    regular: result.regular + Number(item.regular_coins_out || 0),
    extra: result.extra + Number(item.extra_dry_coins_out || 0),
  }), { cash: 0, qris: 0, expenses: 0, cashExpenses: 0, transactions: 0, regular: 0, extra: 0 })

  return <div className="page-stack shift-report-page">
    <div className="page-intro"><div><div className="eyebrow"><Clock3 size={14}/> LAPORAN PERGANTIAN KERJA</div><h2>Laporan Shift</h2><p>Rekap sesi aktual dan pembayaran yang diterima berdasarkan shift penerima.</p></div><button className="btn btn-secondary" onClick={() => notify('Cetak laporan shift belum dikonfigurasi.')}><Printer size={15}/> Cetak rekap</button></div>
    <div className="shift-report-filters"><label><span>Dari tanggal buka</span><div><CalendarDays size={14}/><input type="date" value={from} onChange={event => setFrom(event.target.value)}/></div></label><label><span>Sampai tanggal buka</span><div><CalendarDays size={14}/><input type="date" value={to} onChange={event => setTo(event.target.value)}/></div></label><label><span>Jenis shift</span><div><Clock3 size={14}/><select value={shiftFilter} onChange={event => setShiftFilter(event.target.value)}><option value="">Semua shift</option>{['pagi','siang','sore','malam'].map(value => <option key={value} value={value}>{shiftName(value)}</option>)}</select></div></label><div className="shift-range-note"><i/> Tanggal saat ini mengikuti waktu buka aktual sesi.</div></div>
    {error && <div className="checkout-error" role="alert">{error}</div>}
    <div className="shift-report-metrics"><ReportMetric icon={Wallet} color="blue" label="Tunai diterima" value={money(totals.cash)} caption="Pembayaran tercatat pada shift penerima"/><ReportMetric icon={CreditCard} color="cyan" label="QRIS diterima" value={money(totals.qris)} caption="Belum termasuk biaya rekening"/><ReportMetric icon={ReceiptText} color="orange" label="Pengeluaran shift" value={expensesAvailable ? money(totals.expenses) : 'Belum tersedia'} caption={expensesAvailable ? `${money(totals.cashExpenses)} mengurangi kas laci` : 'Perlu migration ledger expense'}/><ReportMetric icon={Coins} color="violet" label="Koin keluar" value={`${totals.regular + totals.extra} koin`} caption={`${totals.regular} reguler · ${totals.extra} Extra Dry`}/></div>
    <div className="shift-report-layout"><section className="shift-report-list panel"><div className="panel-heading"><div><h3>Rekap setiap shift</h3><p>{loading ? 'Memuat data…' : `${items.length} sesi aktual`}</p></div><span className="shift-report-demo"><i/>{loading ? 'Memuat' : 'Data aktual'}</span></div><div className="shift-report-records">
      {items.map(item => <button key={item.id} className={`shift-record ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}><div className={`shift-record-icon ${item.shift_type}`}><Clock3 size={17}/></div><div className="shift-record-main"><div className="shift-record-title"><b>Shift {shiftName(item.shift_type)}</b><span className={`shift-record-status ${item.status === 'open' ? 'running' : 'closed'}`}><i/>{item.status === 'open' ? 'Berjalan' : 'Ditutup'}</span></div><small>{item.cashier} · {dateLabel(item.started_at.slice(0,10))}</small><div className="shift-record-foot"><span>{dateTime(item.started_at)} — {dateTime(item.ended_at)}</span><span>{item.transaction_count} transaksi</span></div></div><div className="shift-record-amount"><b>{money(item.received_total)}</b><small>diterima</small></div><ChevronRight size={15} className="shift-chevron"/></button>)}
      {!loading && !items.length && <div className="shift-empty">Tidak ada sesi shift pada rentang tanggal ini.</div>}
      {loading && <div className="shift-empty">Memuat sesi shift aktual…</div>}
    </div><div className="shift-list-foot"><Check size={13}/> Penerimaan dihitung dari record pembayaran pada shift penerima.</div></section>
      <aside className="shift-detail panel">{selected ? <><div className="shift-detail-head"><div><div className="section-overline">RINGKASAN PERGANTIAN</div><h3>Shift {shiftName(selected.shift_type)}</h3><p>#{selected.id} · {dateLabel(selected.started_at.slice(0,10))}</p></div><span className={`shift-record-status ${selected.status === 'open' ? 'running' : 'closed'}`}><i/>{selected.status === 'open' ? 'Berjalan' : 'Ditutup'}</span></div><div className="shift-detail-cashier"><div className="profile-avatar">{selected.cashier.split(' ').map(value => value[0]).slice(0, 2).join('').toUpperCase()}</div><span><b>{selected.cashier}</b><small>Kasir shift</small></span></div><div className="shift-time-grid"><div><small>Waktu mulai aktual</small><b>{dateTime(selected.started_at)}</b></div><div><small>Waktu selesai aktual</small><b>{dateTime(selected.ended_at)}</b></div><div><small>Total transaksi</small><b>{selected.transaction_count} transaksi</b></div><div><small>Belum dibayar</small><b>{selected.unpaid_count} transaksi · {money(selected.unpaid_total)}</b></div></div><div className="shift-payment-breakdown"><div className="shift-breakdown-title"><b>Pembayaran diterima</b><small>Dikelompokkan berdasarkan shift penerima</small></div><div><span><i className="cash-dot"/> Tunai</span><b>{money(selected.cash_total)}</b></div><div><span><i className="qris-dot"/> QRIS</span><b>{money(selected.qris_total)}</b></div><div className="shift-payment-total"><span>Total penerimaan</span><b>{money(selected.received_total)}</b></div></div><div className="shift-expense-breakdown"><div className="shift-breakdown-title"><b>Pengeluaran tercatat</b><small>Terhubung dengan sesi shift ini</small></div><div><span>Laci kas</span><b>{money(selected.cash_expense_total)}</b></div><div><span>Rekening usaha / QRIS</span><b>{money(selected.bank_expense_total)}</b></div><div className="shift-payment-total"><span>Total pengeluaran</span><b>{money(selected.expense_total)}</b></div><small className="shift-cash-estimate">Arus tunai setelah expense laci: {money(Number(selected.cash_total || 0) - Number(selected.cash_expense_total || 0))}. Belum termasuk saldo awal/fisik.</small></div><div className="shift-coin-breakdown"><div><ArrowDownLeft size={15}/><span>Koin masuk</span><b>{selected.coins_in}</b></div><div><Coins size={15}/><span>Koin keluar</span><b>{selected.coins_out}</b></div><div><ArrowUpRight size={15}/><span>Penjualan produk</span><b>{money(selected.product_sales)}</b></div><div><Coins size={15}/><span>Produk keluar</span><b>{selected.product_stock_out}</b></div></div><div className="shift-unpaid-note"><ArrowDownLeft size={15}/><span><b>Rekonsiliasi fisik belum tersedia</b><small>Saldo awal, hitung fisik, selisih kas/koin, dan serah terima belum disimpan oleh sistem.</small></span></div><button className="btn btn-secondary shift-print" onClick={() => notify(`Pratinjau rekap shift #${selected.id} belum dikonfigurasi untuk printer.`)}><Printer size={15}/> Cetak ringkasan shift</button></> : <div className="shift-empty">Pilih catatan shift untuk melihat rinciannya.</div>}</aside></div>
    <div className="shared-drawer-note"><Wallet size={15}/><span><b>Penerimaan shift berbeda dari nilai transaksi.</b> Tagihan belum dibayar tidak dihitung sebagai uang diterima; transaksi dan pembayaran dapat berasal dari shift berbeda.</span></div>
    <div className="shift-report-disclaimer">Rekap tanggal saat ini memakai tanggal lokal Asia/Jakarta ketika sesi dibuka. Definisi tanggal operasional final dan rekonsiliasi fisik perlu dikonfirmasi sebelum dipakai sebagai laporan tutup buku.</div>
  </div>
}

function ReportMetric({ icon: Icon, color, label, value, caption }) {
  return <div className="shift-report-metric"><span className={`shift-metric-icon ${color}`}><Icon size={18}/></span><small>{label}</small><b>{value}</b><span>{caption}</span></div>
}
