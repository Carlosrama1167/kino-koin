import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, Banknote, FileText, ReceiptText, Upload } from 'lucide-react'
import { api } from './api'
import './expense-management.css'

const categories = [
  'Pembelian sabun',
  'Pembelian pewangi',
  'Pembelian gas',
  'Perawatan mesin',
  'Pembelian stok lainnya',
  'Pengeluaran operasional lainnya',
]
const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
const dateTime = value => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value))
const createKey = () => window.crypto.randomUUID()

export function ExpenseForm({ onSaved, initialExpense = null, owner = false }) {
  const [category, setCategory] = useState(initialExpense?.category || categories[0])
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount) : '')
  const [description, setDescription] = useState(initialExpense?.description || '')
  const [paymentMethod, setPaymentMethod] = useState(initialExpense?.payment_method || 'tunai')
  const [shiftId, setShiftId] = useState(initialExpense?.shift_id ? String(initialExpense.shift_id) : '')
  const [activeShifts, setActiveShifts] = useState([])
  const [receipt, setReceipt] = useState(null)
  const [changeReason, setChangeReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const keyRef = useRef(null)
  if (!keyRef.current) keyRef.current = createKey()
  const source = paymentMethod === 'tunai' ? 'laci_kas' : 'rekening_usaha'
  const isEditing = Boolean(initialExpense)

  useEffect(() => {
    if (isEditing) return
    let active = true
    api('/api/expenses?limit=1').then(result => {
      if (active) setActiveShifts(result.active_shifts || [])
    }).catch(reason => {
      if (active) setError(reason.message)
    })
    return () => { active = false }
  }, [isEditing])

  const changed = setter => event => {
    setter(event.target.value)
    keyRef.current = createKey()
    setError('')
  }

  const submit = async event => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (isEditing) {
        await api(`/api/expenses/${initialExpense.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            category,
            amount,
            description,
            payment_method: paymentMethod,
            funding_source: source,
            change_reason: changeReason,
          }),
        })
        setSuccess('Koreksi tersimpan dan tercatat pada audit.')
      } else {
        const formData = new FormData()
        formData.set('category', category)
        formData.set('amount', amount)
        formData.set('description', description)
        formData.set('payment_method', paymentMethod)
        formData.set('funding_source', source)
        formData.set('idempotency_key', keyRef.current)
        if (shiftId) formData.set('shift_id', shiftId)
        if (receipt) formData.set('receipt', receipt)
        const result = await api('/api/expenses', { method: 'POST', body: formData })
        setSuccess(`Pengeluaran ${result.expense.expense_number} berhasil disimpan.`)
        setAmount('')
        setDescription('')
        setReceipt(null)
        setShiftId('')
        keyRef.current = createKey()
        event.target.reset()
      }
      onSaved?.()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSaving(false)
    }
  }

  return <form className="expense-form" onSubmit={submit}>
    <div className="expense-form-grid">
      <label>Kategori
        <select value={category} onChange={changed(setCategory)} required>
          {categories.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>Nominal (Rp)
        <input type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={changed(setAmount)} required/>
      </label>
      <label>Keterangan
        <input type="text" maxLength="500" value={description} onChange={changed(setDescription)} placeholder="Tujuan atau rincian pengeluaran" required/>
      </label>
      <label>Metode pembayaran
        <select value={paymentMethod} onChange={changed(setPaymentMethod)} required>
          <option value="tunai">Tunai</option>
          <option value="qris">QRIS</option>
        </select>
      </label>
      <label>Sumber dana
        <input value={paymentMethod === 'tunai' ? 'Laci kas' : 'Rekening usaha'} readOnly aria-readonly="true"/>
      </label>
      {!isEditing && owner && activeShifts.length > 0 && <label>Shift terkait (opsional)
        <select value={shiftId} onChange={changed(setShiftId)}>
          <option value="">Tanpa shift</option>
          {activeShifts.map(shift => <option key={shift.id} value={shift.id}>Shift {shift.shift_type} · {shift.cashier || 'Aktif'}</option>)}
        </select>
      </label>}
      {!isEditing && !owner && activeShifts.length > 0 && <div className="expense-current-shift">Pengeluaran akan dikaitkan otomatis ke shift {activeShifts[0].shift_type} yang sedang dibuka.</div>}
      {isEditing ? <label className="expense-field-wide">Alasan koreksi
        <input value={changeReason} onChange={changed(setChangeReason)} maxLength="500" required placeholder="Wajib untuk audit perubahan"/>
      </label> : <label className="expense-field-wide expense-upload">
        <span>Bukti transaksi <small>Wajib · JPG, PNG, WebP, PDF · maksimal 5 MB</small></span>
        <span className="expense-upload-control"><Upload size={16}/><span>{receipt?.name || 'Pilih bukti transaksi'}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => { setReceipt(event.target.files?.[0] || null); keyRef.current = createKey(); setError('') }} required/></span>
      </label>}
    </div>
    {error && <div className="expense-message error" role="alert"><AlertCircle size={16}/>{error}</div>}
    {success && <div className="expense-message success" role="status"><ReceiptText size={16}/>{success}</div>}
    <div className="expense-form-actions">
      {!isEditing && <p><Banknote size={15}/> Tunai mengurangi kas laci; QRIS dicatat terhadap rekening usaha.</p>}
      <button type="submit" className="expense-submit" disabled={saving}>{saving ? 'Menyimpan…' : isEditing ? 'Simpan koreksi' : 'Simpan pengeluaran'}</button>
    </div>
  </form>
}

export default function CashierExpensePage({ notify }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [ledgerReady, setLedgerReady] = useState(null)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api('/api/expenses?limit=100').then(result => {
      if (active) {
        setItems(result.items || [])
        setLedgerReady(true)
      }
    }).catch(reason => {
      if (active) {
        setError(reason.message)
        setLedgerReady(false)
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [refreshVersion])

  const saved = () => setRefreshVersion(value => value + 1)

  return <div className="page-stack expense-page">
    <div className="page-intro"><div><div className="eyebrow"><ReceiptText size={14}/> OPERASIONAL</div><h2>Pengeluaran</h2><p>Catat biaya shift dengan bukti transaksi agar masuk ke laporan Owner.</p></div></div>
    <section className="panel expense-panel">
      <div className="expense-panel-heading"><div><h3>Catat pengeluaran</h3><p>Data tersimpan ke PostgreSQL setelah berhasil dikonfirmasi.</p></div><FileText size={18}/></div>
      {ledgerReady ? <ExpenseForm onSaved={saved}/> : loading ? <div className="expense-empty">Memeriksa ketersediaan ledger…</div> : <div className="expense-message error" role="alert"><AlertCircle size={16}/>{error || 'Ledger pengeluaran belum tersedia.'}</div>}
    </section>
    <section className="panel expense-panel">
      <div className="expense-panel-heading"><div><h3>Pengeluaran tercatat</h3><p>{loading ? 'Memuat data…' : `${items.length} catatan terbaru`}</p></div></div>
      {error && <div className="expense-message error" role="alert"><AlertCircle size={16}/>{error}</div>}
      {loading ? <div className="expense-empty">Memuat pengeluaran…</div> : items.length ? <div className="expense-list">
        {items.map(item => <article className="expense-list-item" key={item.id}>
          <span className="expense-list-icon"><ReceiptText size={17}/></span>
          <div className="expense-list-copy"><b>{item.category}</b><small>{item.expense_number} · {item.description}</small><small>{dateTime(item.created_at)} · {item.payment_method.toUpperCase()} · {item.operator}</small></div>
          <div className="expense-list-value"><b>{money(item.amount)}</b><a href={item.receipt_url}>Bukti</a></div>
        </article>)}
      </div> : <div className="expense-empty">Belum ada pengeluaran yang dicatat.</div>}
    </section>
  </div>
}
