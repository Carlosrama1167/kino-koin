import React, { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleHelp, Coins, History, Plus, X } from 'lucide-react'
import { api } from '../../../shared/api'

const dateTime = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—'

export default function CoinManagement({ notify }) {
  const [balances, setBalances] = useState([])
  const [movements, setMovements] = useState([])
  const [selected, setSelected] = useState(null)
  const [action, setAction] = useState('keluar')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [coinResult, movementResult] = await Promise.all([
        api('/api/coins'),
        api('/api/coins/movements?limit=100'),
      ])
      setBalances(coinResult.items.map((coin, index) => ({ ...coin, stock: Number(coin.stock), color: index % 2 ? 'cyan' : 'blue' })))
      setMovements(movementResult.items)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const openForm = (coin, movementType) => {
    setSelected(coin)
    setAction(movementType)
    setQuantity('')
    setReason('')
    setError('')
  }

  const submit = async event => {
    event.preventDefault()
    if (!selected || saving || !reason.trim()) return
    const amount = Number(quantity)
    if (!Number.isInteger(amount) || (action === 'penyesuaian' ? amount < 0 : amount < 1)) return
    setSaving(true)
    setError('')
    try {
      await api('/api/coins/movements', {
        method: 'POST',
        body: JSON.stringify(action === 'penyesuaian'
          ? { coin_type_id: selected.id, movement_type: action, stock_count: amount, reason: reason.trim() }
          : { coin_type_id: selected.id, movement_type: action, quantity: amount, reason: reason.trim() }),
      })
      await loadData()
      setSelected(null)
      setQuantity('')
      setReason('')
      notify(`Mutasi ${selected.name} berhasil disimpan.`)
    } catch (failure) {
      setError(failure.message)
      notify(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="page-stack coin-page">
    <div className="page-intro"><div><div className="eyebrow"><Coins size={14}/> OPERASIONAL TOKO</div><h2>Manajemen Koin</h2><p>Saldo dan mutasi koin aktual dari database.</p></div><button className="btn btn-secondary" onClick={() => document.getElementById('coin-movement-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><History size={16}/> Riwayat koin</button></div>
    {error && !selected && <div className="checkout-error" role="alert">{error}</div>}
    <div className="coin-summary-cards">{balances.map(item => <section key={item.id} className="coin-balance-card"><div className="coin-card-top"><span className={`coin-large-icon ${item.color}`}><Coins size={20}/></span><span className="coin-live"><i/> Saldo aktual</span></div><small>{item.name}</small><div className="coin-balance-number">{item.stock}<span> koin</span></div><p>{item.description || 'Deskripsi belum tersedia.'}</p><button className="coin-record-out" onClick={() => openForm(item, 'keluar')}><ArrowDownLeft size={15}/> Catat koin keluar</button><button className="coin-record-in" onClick={() => openForm(item, 'masuk')}><Plus size={14}/> Catat koin masuk</button><button className="coin-record-in" onClick={() => openForm(item, 'penyesuaian')}><History size={14}/> Koreksi hasil hitung</button></section>)}</div>
    {!loading && balances.length === 0 && <div className="inventory-note">Belum ada jenis koin aktif pada database.</div>}
    <section className="coin-guide panel"><span><CircleHelp size={17}/></span><div><b>Aturan penggunaan koin</b><p>Mutasi manual dicatat dengan alasan dan petugas. Pengurangan koin otomatis dari layanan belum diaktifkan karena jumlah koin per layanan belum tersimpan sebagai aturan bisnis.</p></div></section>
    <section id="coin-movement-list" className="coin-history panel"><div className="panel-heading"><div><h3>Riwayat pergerakan koin</h3><p>{loading ? 'Memuat mutasi…' : `${movements.length} mutasi aktual ditampilkan`}</p></div><span className="coin-history-badge"><History size={13}/> Database</span></div><div className="coin-history-table-wrap"><table className="coin-history-table"><thead><tr><th>ID catatan</th><th>Waktu</th><th>Jenis koin</th><th>Pergerakan</th><th>Jumlah</th><th>Petugas & alasan</th></tr></thead><tbody>{movements.map(item => <tr key={item.id}><td><b>KM-{String(item.id).padStart(4, '0')}</b></td><td>{dateTime(item.created_at)}</td><td>{item.coin}</td><td><span className={`coin-movement-type ${item.direction === 'keluar' ? 'keluar' : 'masuk'}`}>{item.direction === 'keluar' ? <ArrowDownLeft size={13}/> : <ArrowUpRight size={13}/>} {item.movement_type}</span></td><td><b>{item.direction === 'keluar' ? '−' : '+'}{item.quantity} koin</b></td><td>{item.operator || '—'} · {item.reason || '—'}</td></tr>)}</tbody></table>{!loading && !movements.length && <div className="inventory-empty">Belum ada mutasi koin.</div>}</div></section>
    {selected && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && setSelected(null)}><form className="coin-modal" onSubmit={submit}><div className="inventory-modal-head"><span><small>MUTASI KOIN</small><b>{selected.name}</b></span><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Tutup"><X size={17}/></button></div><div className="inventory-current"><span>Saldo saat ini</span><b>{selected.stock} koin</b></div><label className="inventory-qty">Jenis mutasi<select value={action} onChange={event => setAction(event.target.value)}><option value="keluar">Keluar</option><option value="masuk">Masuk</option><option value="penyesuaian">Koreksi hasil hitung fisik</option></select></label><label className="inventory-qty">{action === 'penyesuaian' ? 'Saldo fisik hasil hitung' : 'Jumlah koin'}<input autoFocus type="number" min={action === 'penyesuaian' ? '0' : '1'} step="1" required value={quantity} onChange={event => setQuantity(event.target.value)}/></label><label className="inventory-qty">Alasan mutasi<input required maxLength="500" value={reason} onChange={event => setReason(event.target.value)} placeholder="Wajib diisi untuk audit"/></label>{error && <div className="checkout-error" role="alert">{error}</div>}<button type="submit" className="btn btn-primary inventory-submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan mutasi'}</button></form></div>}
  </div>
}
