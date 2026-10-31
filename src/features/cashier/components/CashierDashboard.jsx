import React, { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, CreditCard, Plus, Shirt, Wallet } from 'lucide-react'
import { api } from '../../../shared/api'

const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
const timeLabel = value => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

export default function CashierDashboard({ onNavigate, onCloseShift, closing = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/cashier/dashboard')
      .then(setData)
      .catch(reason => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  const summary = data?.summary || {}
  const recent = data?.recent || []
  const shift = data?.shift

  return <div className="page-stack">
    <div className="page-intro"><div><div className="eyebrow"><span className="live-dot"/> {shift ? `SHIFT ${shift.shift_type.toUpperCase()} AKTIF` : 'SESI SHIFT TIDAK AKTIF'}</div><h2>Dashboard Kasir</h2><p>Ringkasan transaksi dan pembayaran yang tercatat pada sesi shift ini.</p></div><div className="dashboard-actions"><button className="btn btn-primary" onClick={() => onNavigate('Transaksi Baru')}><Plus size={17}/> Transaksi Baru</button>{shift && <button className="btn btn-secondary" onClick={onCloseShift} disabled={closing}>{closing ? 'Menutup shift…' : 'Tutup shift'}</button>}</div></div>
    {error && <div className="checkout-error" role="alert">{error}</div>}
    <div className="owner-metrics cashier-metrics">
      <div className="owner-metric"><div className="owner-metric-icon tone-0"><Wallet size={18}/></div><small>Penerimaan shift</small><b>{loading ? 'Memuat…' : money(summary.received_total)}</b><span><ArrowUpRight size={12}/> Pembayaran tercatat</span></div>
      <div className="owner-metric"><div className="owner-metric-icon tone-1"><Shirt size={18}/></div><small>Total transaksi</small><b>{loading ? 'Memuat…' : `${summary.transaction_count || 0} transaksi`}</b><span>Nilai belum lunas tidak dihitung sebagai penerimaan</span></div>
      <div className="owner-metric"><div className="owner-metric-icon tone-2"><Wallet size={18}/></div><small>Pembayaran tunai</small><b>{loading ? 'Memuat…' : money(summary.cash_total)}</b><span>Uang tunai yang tercatat</span></div>
      <div className="owner-metric"><div className="owner-metric-icon tone-3"><CreditCard size={18}/></div><small>Pembayaran QRIS</small><b>{loading ? 'Memuat…' : money(summary.qris_total)}</b><span>Termasuk penerimaan yang dikonfirmasi manual</span></div>
    </div>
    <section className="panel dashboard-transactions"><div className="panel-heading"><div><h3>Transaksi terbaru</h3><p>Transaksi aktual pada shift ini</p></div><button className="link-button" onClick={() => onNavigate('Riwayat Transaksi')}>Lihat riwayat <ArrowRight size={14}/></button></div>
      <div className="recent-list">{recent.map(transaction => <DashboardRecent key={transaction.id} name={transaction.customer || 'Pelanggan umum'} service={transaction.items || transaction.transaction_type} time={timeLabel(transaction.created_at)} amount={money(transaction.total)} status={transaction.payment_status === 'lunas' ? 'Lunas' : 'Belum Bayar'}/>)}
        {!loading && !error && !recent.length && <div className="empty-orders">Belum ada transaksi pada shift ini.</div>}
        {loading && <div className="empty-orders">Memuat transaksi aktual…</div>}
      </div>
    </section>
    <section className="dashboard-shift panel"><div className="shift-icon"><Wallet size={17}/></div><div><b>Ringkasan shift individu</b><small>Penerimaan dihitung dari pembayaran yang tercatat pada shift penerima.</small></div><button className="link-button" onClick={() => onNavigate('Laporan')}>Detail shift <ArrowRight size={14}/></button></section>
  </div>
}

function DashboardRecent({ name, service, time, amount, status }) {
  const initials = name.split(' ').map(value => value[0]).slice(0, 2).join('').toUpperCase()
  return <div className="recent-row"><div className="customer-avatar lavender">{initials}</div><div className="recent-customer"><b>{name}</b><small>{service}</small></div><span className="recent-time">{time}</span><span className={`paid-badge ${status === 'Lunas' ? 'paid' : 'unpaid'}`}>{status}</span><b className="recent-amount">{amount}</b></div>
}
