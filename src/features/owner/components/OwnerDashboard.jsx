import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, Coins, Download, FileSpreadsheet, Package, Shirt, Ticket, Wallet, WashingMachine } from 'lucide-react'
import { api } from '../../../shared/api'

const periods = [
  ['today', 'Hari ini'],
  ['7days', '7 hari terakhir'],
  ['month', 'Bulan ini'],
  ['custom', 'Kustom'],
]

const money = value => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

function periodDates(period) {
  const end = today()
  const [year, month, day] = end.split('-').map(Number)
  let start
  if (period === 'today') start = end
  else if (period === '7days') start = new Date(Date.UTC(year, month - 1, day - 6)).toISOString().slice(0, 10)
  else start = `${year}-${String(month).padStart(2, '0')}-01`
  return { start, end }
}

export default function OwnerDashboard({ user, onNavigate, notify }) {
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState(() => periodDates('month').start)
  const [customTo, setCustomTo] = useState(today)
  const [appliedRange, setAppliedRange] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [membershipSummary, setMembershipSummary] = useState(null)
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [membershipError, setMembershipError] = useState('')

  const query = useMemo(() => {
    if (period === 'custom' && !appliedRange) return ''
    const params = new URLSearchParams({ period })
    if (period === 'custom') {
      params.set('from', appliedRange.from)
      params.set('to', appliedRange.to)
    }
    params.set('refresh', String(refreshVersion))
    return params.toString()
  }, [period, appliedRange, refreshVersion])

  useEffect(() => {
    if (!query) {
      setLoading(false)
      setData(null)
      setError('')
      return undefined
    }
    let active = true
    setLoading(true)
    setData(null)
    setError('')
    api(`/api/owner/dashboard?${query}`)
      .then(result => { if (active) setData(result) })
      .catch(reason => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])
  useEffect(() => {
    let active = true
    setMembershipLoading(true); setMembershipError('')
    api('/api/owner/membership/summary')
      .then(result => { if (active) setMembershipSummary(result) })
      .catch(reason => { if (active) setMembershipError(reason.message) })
      .finally(() => { if (active) setMembershipLoading(false) })
    return () => { active = false }
  }, [refreshVersion])

  const orders = data?.orders || []
  const activeOrders = orders
    .filter(order => ['menunggu', 'diproses', 'selesai'].includes(order.status))
    .reduce((sum, order) => sum + Number(order.count), 0)
  const chart = data?.chart || []
  const maxRevenue = Math.max(...chart.map(row => Number(row.revenue)), 0)
  const dates = data ? `${data.from} – ${data.to}` : ''

  const exportSummary = () => {
    if (!data) return
    const rows = [
      ['Tanggal', 'Pendapatan lunas'],
      ...chart.map(row => [row.date, row.revenue]),
    ]
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `kino-ringkasan-${data.from}-${data.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
    notify('Ringkasan pendapatan berhasil diunduh.')
  }

  const applyCustomRange = () => {
    if (!customFrom || !customTo || customFrom > customTo) {
      setError('Tanggal awal dan akhir wajib valid.')
      return
    }
    setError('')
    setAppliedRange({ from: customFrom, to: customTo })
  }

  return <div className="owner-dashboard-page">
    <header className="owner-dashboard-top">
      <div>
        <div className="owner-dashboard-badges">
          <span className="owner-dashboard-badge">Ringkasan bisnis</span>
          {data && <span className="owner-dashboard-badge owner-dashboard-badge-live"><i/>Data aktual</span>}
        </div>
        <h2>Selamat datang, {user?.name || 'Owner'}</h2>
        <p>Pendapatan dan aktivitas operasional berdasarkan data tersimpan.</p>
      </div>
      <div className="owner-dashboard-actions">
        <button className="owner-action soft" onClick={() => setRefreshVersion(value => value + 1)} disabled={loading}>Muat ulang</button>
        <button className="owner-action primary" onClick={exportSummary} disabled={!data || loading}><Download size={16}/> Ekspor CSV</button>
      </div>
    </header>

    <section className="owner-period-bar" aria-label="Filter periode dashboard">
      <div className="owner-period-tabs">{periods.map(([value, label]) =>
        <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>
          {value === 'custom' && <CalendarDays size={14}/>} {label}
        </button>
      )}</div>
      {period === 'custom' ? <div className="owner-custom-range">
        <label>Dari <input type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)}/></label>
        <label>Sampai <input type="date" value={customTo} onChange={event => setCustomTo(event.target.value)}/></label>
        <button className="owner-action soft" onClick={applyCustomRange}>Terapkan</button>
      </div> : <span className="owner-period-date"><CalendarDays size={14}/> {dates || 'Memuat periode…'}</span>}
    </section>

    {period === 'custom' && !appliedRange && <div className="owner-state">Pilih rentang tanggal lalu tekan Terapkan untuk memuat data.</div>}
    {error && <div className="owner-state error" role="alert">{error}</div>}
    <section className="owner-kpis" aria-label="Ringkasan utama outlet">
      <StatCard
        icon={Wallet}
        color="blue"
        label="Pendapatan lunas"
        value={data ? money(data.summary.revenue) : loading ? 'Memuat…' : '—'}
        detail={data ? `${data.summary.paid_transactions} transaksi lunas · ${dates}` : 'Data periode belum dimuat'}
      />
      <StatCard
        icon={Shirt}
        color="cyan"
        label="Pesanan aktif"
        value={loading && !data ? 'Memuat…' : `${activeOrders} pesanan`}
        detail="Menunggu, diproses, atau selesai."
      />
      <article className="owner-kpi-card owner-attendance-kpi">
        <span className="owner-kpi-icon blue"><WashingMachine size={19}/></span>
        <small>Karyawan hadir hari ini</small>
        <b>{data ? `${data.attendance_today} orang` : loading ? 'Memuat…' : '—'}</b>
        <button className="owner-text-action" onClick={() => onNavigate('Manajemen Karyawan & Shift')}>Lihat kehadiran</button>
      </article>
    </section>
    <section className="owner-panel owner-membership-summary">
      <div className="owner-panel-heading">
        <div><h3>Membership</h3><p>Ringkasan member aktif, kartu penuh, dan kupon undian.</p></div>
        <button className="owner-text-action" onClick={() => onNavigate('Manajemen Membership')}>Kelola membership</button>
      </div>
      {membershipError ? <div className="owner-state error" role="alert">{membershipError}</div> : membershipLoading ? <div className="owner-state">Memuat ringkasan membership…</div> :
        <div className="owner-status-list">
          <div><span>Member aktif</span><b><Ticket size={14}/> {membershipSummary.active_members}</b></div>
          <div><span>Kartu penuh</span><b>{membershipSummary.full_cards}</b></div>
          <div><span>Kupon undian</span><b>{membershipSummary.raffle_coupons}</b></div>
        </div>}
    </section>
    <p className="owner-data-note">Laporan Keuangan memisahkan transaksi, pembayaran, dan pengeluaran. Ledger pengeluaran aktif setelah migration diterapkan.</p>

    {loading && !data && <div className="owner-state">Memuat ringkasan outlet…</div>}
    {data && <>
      <section className="owner-analytics-grid">
        <article className="owner-panel owner-live-panel">
          <div className="owner-panel-heading"><div><h3>Pendapatan per hari</h3><p>Transaksi lunas pada {dates}</p></div><span className="owner-live-source">Data database</span></div>
          {chart.length ? <div className="owner-revenue-chart" role="group" aria-label="Grafik pendapatan harian">
            {chart.map(row => <div className="owner-revenue-bar" key={row.date} role="img" aria-label={`${row.date}: ${money(row.revenue)}`} data-tooltip={`${row.date}: ${money(row.revenue)}`} tabIndex={0}>
              <span className="owner-revenue-bar-value">{money(row.revenue)}</span>
              <i style={{ height: `${maxRevenue ? Math.max(4, Number(row.revenue) / maxRevenue * 100) : 0}%` }}/>
              <small>{row.date}</small>
            </div>)}
          </div> : <EmptyState title="Belum ada pendapatan pada periode ini" detail="Grafik akan terisi setelah transaksi lunas tercatat."/>}
        </article>
        <article className="owner-panel">
          <div className="owner-panel-heading"><div><h3>Pembayaran diterima</h3><p>Berdasarkan waktu pembayaran</p></div></div>
          <div className="owner-payment-summary">
            <div><span>Tunai</span><b>{money(data.payments.tunai)}</b></div>
            <div><span>QRIS</span><b>{money(data.payments.qris)}</b></div>
          </div>
        </article>
      </section>

      <section className="owner-panel owner-breakdown-panel">
        <div className="owner-breakdown-grid">
          <div>
            <div className="owner-panel-heading"><div><h3>Status pesanan</h3><p>Jumlah berdasarkan status tersimpan</p></div></div>
            {orders.length ? <div className="owner-status-list">{orders.map(order =>
              <div key={order.status}><span>{orderLabel(order.status)}</span><b>{order.count}</b></div>
            )}</div> : <EmptyState title="Belum ada pesanan" detail="Pesanan laundry akan muncul di sini."/>}
          </div>
          <div>
            <div className="owner-panel-heading"><div><h3>Layanan terlaris</h3><p>Berdasarkan nilai transaksi lunas</p></div></div>
            {data.top_services.length ? <div className="owner-status-list">{data.top_services.map(service =>
              <div key={service.name}><span>{service.name}</span><b>{money(service.revenue)}</b></div>
            )}</div> : <EmptyState title="Belum ada data layanan" detail="Data tersedia setelah transaksi layanan lunas."/>}
          </div>
        </div>
      </section>

      <section className="owner-panel owner-breakdown-panel">
        <div className="owner-breakdown-grid">
          <div>
            <div className="owner-panel-heading"><div><h3>Produk & stok</h3><p>{data.inventory_summary.product_count} produk aktif · {data.inventory_summary.low_stock_count} di batas minimum</p></div><Package size={18}/></div>
            {data.inventory.length ? <div className="owner-status-list">{data.inventory.map(product =>
              <div key={product.id}><span>{product.name} · {product.category}</span><b>{product.stock} {product.unit}</b></div>
            )}</div> : <EmptyState title="Belum ada produk aktif" detail="Produk dan stok akan tampil setelah tersedia di database."/>}
          </div>
          <div>
            <div className="owner-panel-heading"><div><h3>Saldo koin</h3><p>{Number(data.coin_usage || 0)} koin keluar pada periode ini</p></div><Coins size={18}/></div>
            {data.coins.length ? <div className="owner-status-list">{data.coins.map(coin =>
              <div key={coin.id}><span>{coin.name}</span><b>{coin.stock} koin</b></div>
            )}</div> : <EmptyState title="Belum ada jenis koin" detail="Saldo koin akan tampil setelah katalog koin tersedia."/>}
          </div>
        </div>
      </section>

      <section className="owner-panel owner-recent-panel">
        <div className="owner-panel-heading"><div><h3>Sesi shift terbaru</h3><p>Pencatatan sesi aktual dan penerimaan pembayaran</p></div><Clock3 size={18}/></div>
        {data.recent_shifts.length ? <div className="owner-recent-list">{data.recent_shifts.map(shift =>
          <div key={shift.id}>
            <span className="owner-recent-icon"><Clock3 size={16}/></span>
            <span><b>Shift {shift.shift_type} · {shift.cashier}</b><small>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(shift.started_at))} · {shift.status === 'open' ? 'Berjalan' : 'Ditutup'}</small></span>
            <span className={`owner-payment-status ${shift.status === 'open' ? 'belum_bayar' : 'lunas'}`}>{shift.status === 'open' ? 'Berjalan' : 'Ditutup'}</span>
            <b>{money(shift.received_total)}</b>
          </div>
        )}</div> : <EmptyState title="Belum ada sesi shift" detail="Sesi shift yang tersimpan akan tampil di sini."/>}
      </section>

      <section className="owner-panel owner-recent-panel">
        <div className="owner-panel-heading"><div><h3>Transaksi terbaru</h3><p>Ringkasan tanpa data pribadi pelanggan</p></div><button className="owner-text-action" onClick={() => onNavigate('Laporan Keuangan')}>Buka laporan</button></div>
        {data.recent.length ? <div className="owner-recent-list">{data.recent.map(item =>
          <div key={item.transaction_number}>
            <span className="owner-recent-icon"><FileSpreadsheet size={16}/></span>
            <span><b>{item.transaction_number}</b><small>{item.transaction_type} · {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(item.created_at))}</small></span>
            <span className={`owner-payment-status ${item.payment_status}`}>{item.payment_status === 'lunas' ? 'Lunas' : 'Belum bayar'}</span>
            <b>{money(item.total)}</b>
          </div>
        )}</div> : <EmptyState title="Belum ada transaksi" detail="Transaksi pada periode ini akan tampil di sini."/>}
      </section>
    </>}
  </div>
}

function StatCard({ icon: Icon, color, label, value, detail }) {
  return <article className="owner-kpi-card">
    <span className={`owner-kpi-icon ${color}`}><Icon size={19}/></span>
    <small>{label}</small>
    <b>{value}</b>
    <div>{detail}</div>
  </article>
}

function EmptyState({ title, detail }) {
  return <div className="owner-empty-state"><WashingMachine size={22}/><b>{title}</b><span>{detail}</span></div>
}

function orderLabel(status) {
  return ({
    menunggu: 'Menunggu',
    diproses: 'Diproses',
    selesai: 'Selesai',
    sudah_diambil: 'Sudah diambil',
    dibatalkan: 'Dibatalkan',
  })[status] || status
}
