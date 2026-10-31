import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ClipboardList, Package, Plus, Search, X, Link2 } from 'lucide-react'
import { api } from '../../../shared/api'
import '../styles/inventory-expense.css'

const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
const dateTime = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—'

export default function InventoryManagement({ notify }) {
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('Semua')
  const [selected, setSelected] = useState(null)
  const [action, setAction] = useState('masuk')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [expenseId, setExpenseId] = useState('')
  const [expenses, setExpenses] = useState([])
  const [expenseLookupError, setExpenseLookupError] = useState('')
  const idempotencyKey = useRef(null)
  if (!idempotencyKey.current) idempotencyKey.current = window.crypto.randomUUID()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [productResult, movementResult] = await Promise.all([
        api('/api/products'),
        api('/api/inventory/movements?limit=100'),
      ])
      setProducts(productResult.items.map(row => ({
        ...row,
        stock: Number(row.stock),
        minimum: Number(row.minimum_stock || 0),
        price: Number(row.price),
        updated: 'Data aktual',
      })))
      setMovements(movementResult.items.map(mapMovement))
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    if (!selected || action !== 'masuk') return undefined
    let active = true
    api('/api/expenses?limit=100').then(result => {
      if (active) {
        setExpenses((result.items || []).filter(item => item.category.toLowerCase().includes('pembelian')))
        setExpenseLookupError('')
      }
    }).catch(failure => {
      if (active) {
        setExpenses([])
        setExpenseLookupError(failure.message)
      }
    })
    return () => { active = false }
  }, [selected?.id, action])

  const filtered = useMemo(() => products.filter(product => {
    const category = product.category.toLowerCase()
    const groupMatch = group === 'Semua' || category.includes(group.toLowerCase())
    return groupMatch && product.name.toLowerCase().includes(query.toLowerCase())
  }), [products, group, query])
  const lowCount = products.filter(product => product.stock <= product.minimum).length
  const categoriesCount = new Set(products.map(product => product.category)).size

  const submit = async event => {
    event.preventDefault()
    if (!selected || saving) return
    const amount = Number(quantity)
    if (!Number.isFinite(amount) || (action === 'masuk' ? amount <= 0 : amount < 0) || !reason.trim()) return
    setSaving(true)
    setError('')
    try {
      await api('/api/inventory/movements', {
        method: 'POST',
        body: JSON.stringify(action === 'masuk'
          ? {
            product_id: selected.id,
            movement_type: 'masuk',
            quantity: amount,
            reason: reason.trim(),
            ...(expenseId ? { expense_id: Number(expenseId), idempotency_key: idempotencyKey.current } : {}),
          }
          : { product_id: selected.id, movement_type: 'penyesuaian', stock_count: amount, reason: reason.trim() }),
      })
      await loadData()
      setSelected(null)
      setQuantity('')
      setReason('')
      setExpenseId('')
      idempotencyKey.current = window.crypto.randomUUID()
      notify(`Stok ${selected.name} berhasil diperbarui.`)
    } catch (failure) {
      setError(failure.message)
      notify(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="page-stack inventory-page">
    <div className="page-intro"><div><div className="eyebrow"><Package size={14}/> OPERASIONAL TOKO</div><h2>Produk & Stok</h2><p>Stok dan pergerakan inventaris aktual dari database.</p></div><button className="btn btn-secondary" onClick={() => setHistoryOpen(true)}><ClipboardList size={16}/> Riwayat stok</button></div>
    <div className="inventory-summary"><div><span className="inventory-summary-icon blue"><Package size={17}/></span><small>Jenis produk</small><b>{products.length}</b><span>Produk aktif</span></div><div><span className="inventory-summary-icon orange"><AlertTriangle size={17}/></span><small>Stok perlu perhatian</small><b>{lowCount}</b><span>Di bawah batas minimum</span></div><div><span className="inventory-summary-icon green"><ArrowDown size={17}/></span><small>Kategori tersedia</small><b>{categoriesCount}</b><span>Kategori database</span></div></div>
    {error && <div className="checkout-error" role="alert">{error}</div>}
    <section className="inventory-table-card"><div className="inventory-toolbar"><div><h3>Daftar inventaris</h3><p>{loading ? 'Memuat stok…' : 'Sumber data produk dan stok aktual.'}</p></div><div className="inventory-controls"><label className="inventory-search"><Search size={15}/><input placeholder="Cari produk..." value={query} onChange={event => setQuery(event.target.value)}/></label><div className="inventory-tabs">{['Semua', 'Laundry', 'Minuman'].map(item => <button key={item} className={group === item ? 'active' : ''} onClick={() => setGroup(item)}>{item}</button>)}</div></div></div>
      <div className="inventory-scroll"><table className="inventory-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Stok tersedia</th><th>Harga jual</th><th>Status stok</th><th>Sumber</th><th>Aksi</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><div className="inventory-product"><span className={`inventory-product-icon ${item.category.toLowerCase().includes('minuman') ? 'drink' : ''}`}><Package size={16}/></span><b>{item.name}</b></div></td><td>{item.category}</td><td><b className="stock-count">{item.stock}</b> <small>{item.unit}</small><div className="stock-minimum">Batas minimum {item.minimum} {item.unit}</div></td><td>{rupiah(item.price)}</td><td><span className={`stock-state ${item.stock <= item.minimum ? 'low' : 'safe'}`}><i/>{item.stock <= item.minimum ? 'Stok menipis' : 'Stok aman'}</span></td><td>{item.updated}</td><td><button className="inventory-action" onClick={() => { setSelected(item); setAction('masuk'); setQuantity(''); setReason(''); setExpenseId(''); idempotencyKey.current = window.crypto.randomUUID() }}><Plus size={13}/> Atur stok</button></td></tr>)}</tbody></table>{!loading && filtered.length === 0 && <div className="inventory-empty">Tidak ada produk aktif yang cocok dengan filter.</div>}</div>
    </section>
    <div className="inventory-note"><AlertTriangle size={14}/> Perubahan stok memerlukan alasan dan dicatat sebagai mutasi di server.</div>
    {selected && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && setSelected(null)}><form className="inventory-modal" onSubmit={submit}><div className="inventory-modal-head"><span><small>PERUBAHAN INVENTARIS</small><b>{selected.name}</b></span><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Tutup"><X size={17}/></button></div><div className="inventory-current"><span>Stok saat ini</span><b>{selected.stock} {selected.unit}</b></div><div className="inventory-action-tabs"><button type="button" className={action === 'masuk' ? 'selected' : ''} onClick={() => setAction('masuk')}><ArrowUp size={14}/> Tambah stok</button><button type="button" className={action === 'penyesuaian' ? 'selected' : ''} onClick={() => setAction('penyesuaian')}><ClipboardList size={14}/> Sesuaikan stok</button></div><label className="inventory-qty">{action === 'masuk' ? 'Jumlah stok masuk' : 'Stok fisik hasil hitung'}<input autoFocus type="number" min={action === 'masuk' ? '0.01' : '0'} step="0.01" required value={quantity} onChange={event => { setQuantity(event.target.value); idempotencyKey.current = window.crypto.randomUUID() }} placeholder={`Jumlah dalam ${selected.unit}`}/></label>{action === 'masuk' && <label className="inventory-qty">Tautkan pengeluaran pembelian (opsional)<select value={expenseId} onChange={event => { setExpenseId(event.target.value); idempotencyKey.current = window.crypto.randomUUID() }}><option value="">Penerimaan tanpa tautan expense</option>{expenses.map(item => <option key={item.id} value={item.id}>{item.expense_number} · {item.category} · {rupiah(item.amount)}</option>)}</select>{expenseLookupError && <small className="inventory-expense-warning"><Link2 size={12}/> {expenseLookupError}</small>}</label>}<label className="inventory-qty">Alasan mutasi<input required maxLength="500" value={reason} onChange={event => { setReason(event.target.value); idempotencyKey.current = window.crypto.randomUUID() }} placeholder="Contoh: stok opname atau barang diterima"/></label><p>{action === 'masuk' ? 'Penerimaan stok dicatat terpisah; tautkan ke expense agar tidak tercatat sebagai pengeluaran kedua.' : 'Stok disesuaikan ke hasil hitung fisik; saldo negatif ditolak.'}</p>{error && <div className="checkout-error" role="alert">{error}</div>}<button type="submit" className="btn btn-primary inventory-submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button></form></div>}
    {historyOpen && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setHistoryOpen(false)}><section className="inventory-history-modal"><div className="inventory-modal-head"><span><small>CATATAN INVENTARIS</small><b>Riwayat stok</b></span><button className="icon-button" onClick={() => setHistoryOpen(false)} aria-label="Tutup"><X size={17}/></button></div><div className="movement-list">{movements.map(movement => <div key={movement.id} className="movement-row"><span className={`movement-icon ${movement.direction === 'masuk' ? 'positive' : 'negative'}`}>{movement.direction === 'masuk' ? <ArrowUp size={15}/> : <ArrowDown size={15}/>}</span><span className="movement-copy"><b>{movement.product} · {movement.kind}</b><small>{dateTime(movement.created_at)} · {movement.operator || '—'} · {movement.reason || 'Tanpa alasan tercatat'}{movement.expense_number ? ` · ${movement.expense_number}` : ''}</small></span><strong className={movement.direction === 'masuk' ? 'positive-text' : ''}>{movement.amount}</strong></div>)}</div>{!movements.length && <div className="inventory-modal-foot">{loading ? 'Memuat riwayat…' : 'Belum ada mutasi stok.'}</div>}</section></div>}
  </div>
}

function mapMovement(row) {
  const label = row.movement_type === 'masuk' ? 'Stok masuk' : row.movement_type === 'keluar' ? 'Stok keluar' : 'Penyesuaian'
  const prefix = row.direction === 'masuk' ? '+' : '−'
  return { ...row, kind: label, amount: `${prefix}${Number(row.quantity)} ${row.unit}` }
}
