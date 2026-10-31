import React, { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Clock3, Search, Shirt } from 'lucide-react'
import { api } from '../../../shared/api'

const statuses = ['Menunggu', 'Diproses', 'Selesai', 'Sudah Diambil', 'Dibatalkan']
const nextStatus = { Menunggu: 'diproses', Diproses: 'selesai', Selesai: 'sudah_diambil' }
const money = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
const statusLabel = value => ({ menunggu: 'Menunggu', diproses: 'Diproses', selesai: 'Selesai', sudah_diambil: 'Sudah Diambil', dibatalkan: 'Dibatalkan' }[value] || value)
const dateTime = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—'

export default function OrderManagement({ notify }) {
  const [orders, setOrders] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Semua status')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const loadOrders = () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ limit: '100' })
    if (filter !== 'Semua status') params.set('status', filter.toLowerCase().replaceAll(' ', '_'))
    if (query.trim()) params.set('search', query.trim())
    return api(`/api/orders?${params}`)
      .then(result => setOrders(result.items.map(mapOrder)))
      .catch(reason => setError(reason.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadOrders() }, [filter, query])
  useEffect(() => {
    if (selected) setSelected(orders.find(order => order.recordId === selected.recordId) || null)
  }, [orders])
  const filtered = useMemo(() => orders, [orders])
  const advance = async order => {
    const next = nextStatus[order.status]
    if (!next || saving) return
    setSaving(true)
    try {
      await api(`/api/orders/${order.recordId}/status`, { method: 'PATCH', body: JSON.stringify({ status: next.toLowerCase().replaceAll(' ', '_') }) })
      await loadOrders()
      notify(`Status ${order.id} diperbarui menjadi ${next}`)
    } catch (reason) {
      setError(reason.message)
      notify(reason.message)
    } finally {
      setSaving(false)
    }
  }
  const pendingCount = orders.filter(order => order.status === 'Menunggu').length
  const inProgressCount = orders.filter(order => order.status === 'Diproses').length
  const readyCount = orders.filter(order => order.status === 'Selesai').length
  const unpaidCount = orders.filter(order => order.payment === 'Belum Bayar').length
  return <div className="page-stack">
    <div className="page-intro"><div><div className="eyebrow"><span className="live-dot"/> OPERASIONAL LAUNDRY</div><h2>Pesanan Laundry</h2><p>Pantau progres cucian dan status pembayaran pelanggan.</p></div><div className="page-intro-count"><Shirt size={17}/><b>{orders.filter(o => !['Sudah Diambil', 'Dibatalkan'].includes(o.status)).length}</b><span>pesanan aktif</span></div></div>
    <div className="order-stats"><div><small>Perlu diproses</small><b>{pendingCount}</b><span>Menunggu antrean</span></div><div><small>Sedang dicuci</small><b>{inProgressCount}</b><span>Dalam pengerjaan</span></div><div><small>Siap diambil</small><b>{readyCount}</b><span>Menunggu pelanggan</span></div><div><small>Belum dibayar</small><b>{unpaidCount}</b><span>Tagihan terbuka</span></div></div>
    {error && <div className="checkout-error" role="alert">{error}</div>}
    <section className="panel order-table-panel"><div className="panel-heading order-table-heading"><div><h3>Daftar pesanan</h3><p>{loading ? 'Memuat pesanan…' : `${filtered.length} pesanan ditemukan`}</p></div><div className="order-filters"><label className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama, nomor, pesanan..."/></label><label className="select-filter"><select value={filter} onChange={e => setFilter(e.target.value)}>{['Semua status', ...statuses].map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={14}/></label></div></div>
      <div className="table-scroll"><table className="orders-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Layanan</th><th>Masuk / estimasi</th><th>Status laundry</th><th>Pembayaran</th><th>Total</th><th/></tr></thead><tbody>{filtered.map(order => <tr key={order.id} onClick={() => setSelected(order)}><td><b className="order-id">{order.id}</b><small>{order.weight}</small></td><td><b>{order.name}</b><small>{order.phone}</small></td><td>{order.service}</td><td><span>{order.masuk}</span><small>Est. {order.estimasi}</small></td><td><span className={`order-status status-${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span></td><td><span className={`paid-badge ${order.payment === 'Lunas' ? 'paid' : 'unpaid'}`}>{order.payment}</span></td><td><b>{money(order.total)}</b></td><td><button className="table-action" onClick={e => { e.stopPropagation(); setSelected(order) }}>Detail</button></td></tr>)}</tbody></table>{loading && <div className="empty-orders">Memuat pesanan aktual…</div>}{!loading && !error && filtered.length === 0 && <div className="empty-orders">Belum ada pesanan yang cocok dengan pencarian.</div>}</div>
    </section>
    {selected && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && !saving && setSelected(null)}><section className="order-drawer"><div className="drawer-heading"><div><div className="section-overline">DETAIL PESANAN</div><h2>{selected.id}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Tutup detail">×</button></div><div className="drawer-customer"><div className="customer-avatar lavender">{selected.name.split(' ').map(v => v[0]).slice(0, 2).join('')}</div><div><b>{selected.name}</b><small>{selected.phone}</small></div></div><div className="drawer-total"><small>Total pesanan</small><b>{money(selected.total)}</b><span>{selected.service} · {selected.weight}</span></div><h3 className="timeline-title">Progres laundry</h3><div className="order-timeline">{['Menunggu', 'Diproses', 'Selesai', 'Sudah Diambil'].map((step, index) => { const current = statuses.indexOf(selected.status); const done = current >= index; return <div className={`timeline-step ${done ? 'done' : ''}`} key={step}><span>{done ? <Check size={12}/> : <i/>}</span><div><b>{step}</b><small>{done && index === current ? 'Status saat ini' : done ? 'Selesai' : 'Menunggu'}</small></div></div> })}</div><div className="drawer-payment"><span>Status pembayaran</span><b className={`paid-badge ${selected.payment === 'Lunas' ? 'paid' : 'unpaid'}`}>{selected.payment}</b></div>{selected.notes && <p className="drawer-hint">Catatan: {selected.notes}</p>}{nextStatus[selected.status] && <button className="btn btn-primary drawer-advance" onClick={() => advance(selected)} disabled={saving}><Clock3 size={16}/>{saving ? 'Menyimpan…' : `Perbarui status ke ${nextStatus[selected.status]}`}</button>}<p className="drawer-hint">Perubahan status disimpan dan dicatat ke riwayat pesanan.</p></section></div>}
  </div>
}

function mapOrder(row) {
  const status = statusLabel(row.order_status)
  return {
    recordId: row.id,
    id: row.transaction_number,
    name: row.customer || 'Pelanggan umum',
    phone: row.phone || '—',
    weight: row.weight ? `${Number(row.weight)} kg` : 'Berat belum dicatat',
    service: row.service_type,
    masuk: dateTime(row.created_at),
    estimasi: dateTime(row.estimated_completion),
    status,
    payment: row.payment_status === 'lunas' ? 'Lunas' : 'Belum Bayar',
    total: Number(row.total),
    notes: row.notes || '',
  }
}
