import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Download, FileSpreadsheet, Search, Settings2, ShieldCheck, SlidersHorizontal, Wallet } from 'lucide-react'
import { api } from '../../../shared/api'
import { ExpenseForm } from '../../../shared/ExpenseManagement'

const periods = [['today', 'Hari ini'], ['7days', '7 hari terakhir'], ['month', 'Bulan ini'], ['custom', 'Kustom']]
const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const currentMonthStart = () => `${today().slice(0, 7)}-01`
const csvCell = value => {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export default function OwnerModule({ page, notify }) {
  if (page === 'Laporan Keuangan') return <FinanceReport/>
  if (page === 'Manajemen Harga & Promo') return <PriceManagement notify={notify}/>
  if (page === 'Integrasi Google Sheets') return <IntegrationStatus/>
  return <BusinessSettings notify={notify}/>
}

function FinanceReport() {
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState(currentMonthStart)
  const [to, setTo] = useState(today)
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [appliedRange, setAppliedRange] = useState(null)
  const [data, setData] = useState(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [editingExpense, setEditingExpense] = useState(null)
  const [auditExpense, setAuditExpense] = useState(null)
  const [auditData, setAuditData] = useState(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const query = useMemo(() => {
    if (period === 'custom' && (!appliedRange || !appliedRange.from || !appliedRange.to)) return ''
    const params = new URLSearchParams({ period, search })
    if (paymentMethod) params.set('payment_method', paymentMethod)
    if (paymentStatus) params.set('payment_status', paymentStatus)
    if (expenseCategory) params.set('expense_category', expenseCategory)
    if (period === 'custom') { params.set('from', appliedRange.from); params.set('to', appliedRange.to) }
    return params.toString()
  }, [period, appliedRange, search, paymentMethod, paymentStatus, expenseCategory, refreshVersion])
  useEffect(() => {
    if (!query) { setLoading(false); setData(null); return undefined }
    let active = true
    setLoading(true); setError(''); setData(null)
    api(`/api/owner/finance?${query}`)
      .then(result => { if (active) setData(result) })
      .catch(reason => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])
  useEffect(() => {
    if (!auditExpense) { setAuditData(null); setAuditError(''); return undefined }
    let active = true
    setAuditLoading(true)
    setAuditError('')
    api(`/api/expenses/${auditExpense.id}`)
      .then(result => { if (active) setAuditData(result) })
      .catch(reason => { if (active) setAuditError(reason.message) })
      .finally(() => { if (active) setAuditLoading(false) })
    return () => { active = false }
  }, [auditExpense])
  const exportCsv = () => {
    if (!data || (!data.items.length && !data.expenses?.length)) return
    const rows = [
      ['Jenis data', 'Tanggal', 'ID', 'Pelanggan / kategori', 'Metode / sumber', 'Nominal', 'Status'],
      ...data.items.map(item => ['Transaksi', item.created_at, item.transaction_number, item.customer || '', item.payment_method || '', item.total, item.payment_status]),
      ...data.items.filter(item => Number(item.paid_amount) > 0).map(item => ['Pembayaran', item.paid_at, item.transaction_number, item.customer || '', item.payment_method || '', item.paid_amount, 'Diterima']),
      ...(data.expenses || []).map(item => ['Pengeluaran', item.created_at, item.expense_number, `${item.category} — ${item.description}`, item.funding_source, item.amount, 'Tercatat']),
    ]
    const content = rows.map(row => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = `kino-laporan-${data.from}-${data.to}.csv`; link.click()
    URL.revokeObjectURL(url)
  }
  const applyRange = () => {
    if (!from || !to || from > to) { setError('Rentang tanggal tidak valid.'); return }
    setError(''); setAppliedRange({ from, to })
  }

  return <div className="owner-module owner-report">
    <ModuleIntro title="Laporan Keuangan" description="Nilai transaksi, pembayaran diterima, pengeluaran, dan arus kas bersih dengan basis tanggal yang dibedakan."/>
    <section className="owner-report-filters">
      <div className="owner-period-tabs">{periods.map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{label}</button>)}</div>
      {period === 'custom' && <div className="owner-custom-range">
        <label>Dari <input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
        <label>Sampai <input type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
        <button className="owner-action soft" onClick={applyRange}>Terapkan</button>
      </div>}
      {period === 'custom' && !appliedRange && <span className="owner-period-date">Pilih tanggal lalu tekan Terapkan.</span>}
      <label className="owner-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nomor transaksi atau pelanggan"/></label>
      <label>Metode pembayaran<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option value="">Semua metode</option><option value="tunai">Tunai</option><option value="qris">QRIS</option></select></label>
      <label>Status pembayaran<select value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)}><option value="">Semua status</option><option value="lunas">Lunas</option><option value="belum_bayar">Belum dibayar</option></select></label>
      <label>Kategori pengeluaran<select value={expenseCategory} onChange={event => setExpenseCategory(event.target.value)}><option value="">Semua kategori</option>{['Pembelian sabun','Pembelian pewangi','Pembelian gas','Perawatan mesin','Pembelian stok lainnya','Pengeluaran operasional lainnya'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </section>
    {error && <div className="owner-state error" role="alert">{error}</div>}
    <section className="owner-module-stats">
      <ModuleStat label="Pendapatan transaksi lunas" value={data ? money(data.summary.revenue) : loading ? 'Memuat…' : '—'} detail={data ? `${data.total} transaksi ditemukan` : 'Data aktual'}/>
      <ModuleStat label="Pembayaran diterima" value={data ? money(data.summary.received) : loading ? 'Memuat…' : '—'} detail="Nominal pembayaran tercatat"/>
      <ModuleStat label="Pengeluaran" value={data?.expense_ledger_ready ? money(data.summary.expenses) : loading ? 'Memuat…' : 'Belum tersedia'} detail={data?.expense_ledger_ready ? `${money(data.summary.cash_expenses)} laci · ${money(data.summary.bank_expenses)} rekening` : 'Perlu migration ledger expense'}/>
      <ModuleStat label="Arus kas bersih" value={data?.expense_ledger_ready ? money(data.summary.net_cash_flow) : loading ? 'Memuat…' : 'Belum tersedia'} detail="Bukan laba usaha"/>
    </section>
    <div className="owner-module-note"><AlertCircle size={16}/> Pendapatan mengikuti waktu transaksi, pembayaran mengikuti waktu diterima, dan pengeluaran mengikuti waktu pencatatan. Arus kas bersih bukan laba usaha.</div>
    <section className="owner-module-card">
      <div className="module-heading"><div><h3>Catat pengeluaran Owner</h3><p>Bukti wajib; pilih Tunai untuk laci kas atau QRIS untuk rekening usaha.</p></div></div>
      {data?.expense_ledger_ready ? <ExpenseForm owner onSaved={() => setRefreshVersion(value => value + 1)}/> : <div className="owner-module-note"><AlertCircle size={16}/> Migration expense belum diterapkan. Form aktif setelah schema ledger tersedia.</div>}
    </section>
    <section className="owner-module-card">
      <div className="module-heading"><div><h3>Daftar transaksi</h3><p>{loading ? 'Memuat data…' : `${data?.total || 0} transaksi · maksimum 200 baris per permintaan`}</p></div><button className="owner-module-button" onClick={exportCsv} disabled={!data || (!data.items.length && !data.expenses?.length)}><Download size={15}/> Ekspor CSV</button></div>
      <div className="owner-module-table owner-responsive-table"><table><thead><tr><th>Tanggal</th><th>Transaksi</th><th>Pelanggan</th><th>Metode</th><th>Nominal</th><th>Status</th></tr></thead><tbody>{data?.items.map(item =>
        <tr key={item.transaction_number}><td>{dateTime(item.created_at)}</td><td><b>{item.transaction_number}</b><small>{item.transaction_type}</small></td><td>{item.customer || 'Pelanggan umum'}</td><td>{item.payment_method?.toUpperCase() || '—'}</td><td>{money(item.total)}</td><td><span className={`owner-payment-status ${item.payment_status}`}>{item.payment_status === 'lunas' ? 'Lunas' : 'Belum dibayar'}</span></td></tr>
      )}</tbody></table>
      {query && !loading && !error && !data?.items.length && <EmptyState title="Belum ada transaksi" detail="Tidak ada transaksi yang sesuai dengan periode dan filter ini."/>}
      {loading && <div className="owner-state">Memuat transaksi…</div>}
      </div>
    </section>
    <section className="owner-module-card">
      <div className="module-heading"><div><h3>Pengeluaran tercatat</h3><p>{loading ? 'Memuat data…' : `${data?.expenses?.length || 0} catatan · maksimum 200 baris per permintaan`}</p></div></div>
      <div className="owner-module-table owner-responsive-table"><table><thead><tr><th>Tanggal</th><th>ID pengeluaran</th><th>Kategori & keterangan</th><th>Metode / sumber</th><th>Nominal</th><th>Petugas</th><th>Bukti</th><th>Aksi</th></tr></thead><tbody>{data?.expenses?.map(item =>
        <tr key={item.id}><td>{dateTime(item.created_at)}</td><td><b>{item.expense_number}</b></td><td>{item.category}<small>{item.description}</small></td><td>{item.payment_method.toUpperCase()}<small>{item.funding_source === 'laci_kas' ? 'Laci kas' : 'Rekening usaha'}</small></td><td>{money(item.amount)}</td><td>{item.operator}</td><td><a href={item.receipt_url}>Unduh bukti</a></td><td><div className="owner-expense-actions"><button className="owner-module-button" onClick={() => setEditingExpense(editingExpense?.id === item.id ? null : item)}>{editingExpense?.id === item.id ? 'Tutup' : 'Koreksi'}</button><button className="owner-module-button" onClick={() => setAuditExpense(auditExpense?.id === item.id ? null : item)}>{auditExpense?.id === item.id ? 'Tutup' : 'Riwayat'}</button></div></td></tr>
      )}</tbody></table>
      {!loading && !error && data && !data.expense_ledger_ready && <EmptyState title="Ledger belum tersedia" detail="Terapkan migration expense terlebih dahulu untuk menampilkan catatan."/>}
      {!loading && !error && data?.expense_ledger_ready && !data?.expenses?.length && <EmptyState title="Belum ada pengeluaran" detail="Catatan expense pada periode ini akan muncul di sini."/>}
      </div>
      {editingExpense && <div className="owner-expense-edit"><div className="module-heading"><div><h3>Koreksi {editingExpense.expense_number}</h3><p>Perubahan dicatat beserta alasan dan identitas Owner.</p></div></div><ExpenseForm owner key={editingExpense.id} initialExpense={editingExpense} onSaved={() => { setEditingExpense(null); setRefreshVersion(value => value + 1) }}/></div>}
      {auditExpense && <div className="owner-expense-edit"><div className="module-heading"><div><h3>Riwayat {auditExpense.expense_number}</h3><p>Audit koreksi yang tersimpan di database.</p></div></div>{auditLoading ? <div className="owner-state">Memuat riwayat…</div> : auditError ? <div className="owner-state error" role="alert">{auditError}</div> : !auditData?.audit.length ? <EmptyState title="Belum ada koreksi" detail="Pengeluaran ini belum pernah diubah."/> : <div className="owner-expense-audit">{auditData.audit.map(entry => <article key={entry.id}><div><b>{entry.operator}</b><small>{dateTime(entry.created_at)}</small></div><p>{entry.change_reason}</p><small>{entry.old_values.category} · {money(entry.old_values.amount)} → {entry.new_values.category} · {money(entry.new_values.amount)}</small><small>{entry.old_values.description} → {entry.new_values.description}</small></article>)}</div>}</div>}
    </section>
  </div>
}

function PriceManagement({ notify }) {
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('category')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [basePrice, setBasePrice] = useState('')
  const [nightPrice, setNightPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () => {
    setLoading(true); setError('')
    api('/api/owner/services').then(result => setServices(result.items)).catch(reason => setError(reason.message)).finally(() => setLoading(false))
  }
  useEffect(load, [])
  const categories = [...new Set(services.map(service => service.category))]
  const visible = services.filter(service => (!category || service.category === category) && `${service.name} ${service.code} ${service.category}`.toLowerCase().includes(search.toLowerCase()))
  const ordered = [...visible].sort((a, b) => sort === 'price' ? Number(a.base_price) - Number(b.base_price) : `${a.category}${a.name}`.localeCompare(`${b.category}${b.name}`))
  const edit = service => {
    setSelected(service); setBasePrice(String(service.base_price)); setNightPrice(service.night_price == null ? '' : String(service.night_price))
  }
  const save = async event => {
    event.preventDefault()
    const base = Number(basePrice)
    const night = nightPrice === '' ? null : Number(nightPrice)
    if (!Number.isFinite(base) || base < 0 || (night !== null && (!Number.isFinite(night) || night < 0))) {
      setError('Harga harus berupa angka nol atau lebih.')
      return
    }
    setSaving(true); setError('')
    try {
      await api('/api/owner/services/price', { method: 'PUT', body: JSON.stringify({ service_id: selected.id, base_price: base, night_price: night }) })
      setSelected(null); load(); notify('Tarif layanan berhasil diperbarui.')
    } catch (reason) { setError(reason.message) }
    finally { setSaving(false) }
  }
  return <div className="owner-module">
    <ModuleIntro title="Manajemen Harga & Promo" description="Tarif dibaca dan diperbarui dari katalog layanan PostgreSQL."/>
    {error && <div className="owner-state error" role="alert">{error}</div>}
    <section className="owner-module-card">
      <div className="module-heading"><div><h3>Tarif layanan</h3><p>Harga transaksi yang sudah tersimpan tetap menggunakan harga saat transaksi.</p></div></div>
      <div className="owner-price-filters">
        <label className="owner-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari layanan"/></label>
        <label>Kategori<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Semua kategori</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Urutkan<select value={sort} onChange={event => setSort(event.target.value)}><option value="category">Kategori</option><option value="price">Harga terendah</option></select></label>
      </div>
      <div className="owner-module-table owner-responsive-table"><table><thead><tr><th>Layanan</th><th>Kategori</th><th>Satuan</th><th>Harga normal</th><th>Harga malam</th><th>Status</th><th/></tr></thead><tbody>{ordered.map(service =>
        <tr key={service.id}><td><b>{service.name}</b><small>{service.code}</small></td><td>{service.category}</td><td>{service.pricing_unit}</td><td>{money(service.base_price)}</td><td>{service.night_price == null ? '—' : money(service.night_price)}</td><td>{service.is_active ? 'Aktif' : 'Nonaktif'}</td><td><button className="owner-text-action" disabled={!service.is_active} onClick={() => edit(service)}>Ubah harga</button></td></tr>
      )}</tbody></table>
      {loading && <div className="owner-state">Memuat katalog layanan…</div>}
      {!loading && !error && !ordered.length && <EmptyState title="Belum ada layanan" detail="Tambahkan katalog layanan ke database untuk mengelola tarif."/>}
      </div>
    </section>
    <section className="owner-module-card owner-promo-empty"><span className="owner-empty-icon"><SlidersHorizontal size={19}/></span><div><h3>Promo belum tersedia</h3><p>Database belum memiliki tabel dan endpoint promo. Tidak ada perubahan promo yang dapat disimpan saat ini.</p></div></section>
    {selected && <div className="owner-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && setSelected(null)}>
      <form className="owner-price-modal" onSubmit={save}>
        <div className="module-heading"><div><h3>Ubah tarif layanan</h3><p>{selected.name} · {selected.category}</p></div><button type="button" className="owner-modal-close" onClick={() => setSelected(null)}>×</button></div>
        {error && <div className="owner-state error" role="alert">{error}</div>}
        <label>Harga normal ({selected.pricing_unit})<input type="number" min="0" step="1" required value={basePrice} onChange={event => setBasePrice(event.target.value)}/></label>
        <label>Harga malam (opsional)<input type="number" min="0" step="1" value={nightPrice} onChange={event => setNightPrice(event.target.value)} placeholder="Kosongkan untuk menonaktifkan"/></label>
        <button className="owner-module-button primary" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan tarif'}</button>
      </form>
    </div>}
  </div>
}

function IntegrationStatus() {
  return <div className="owner-module">
    <ModuleIntro title="Integrasi Google Sheets" description="Integrasi tidak dikonfigurasi pada backend saat ini."/>
    <section className="owner-integration-card">
      <div className="integration-icon"><FileSpreadsheet size={25}/></div>
      <div className="integration-status"><span className="module-pending">Belum terhubung</span><h3>Google Sheets belum dikonfigurasi</h3><p>Belum tersedia konfigurasi kredensial, pengujian koneksi, sinkronisasi, atau riwayat sinkronisasi di backend. Tidak ada status sukses yang ditampilkan.</p></div>
    </section>
    <div className="owner-module-note"><ShieldCheck size={16}/> Kredensial atau token integrasi tidak disimpan maupun ditampilkan di frontend.</div>
  </div>
}

function BusinessSettings({ notify }) {
  const [outlet, setOutlet] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', phone: '', attendance_latitude: '', attendance_longitude: '', attendance_checkout_grace_minutes: 30 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attendanceSettingsReady, setAttendanceSettingsReady] = useState(true)
  useEffect(() => {
    api('/api/owner/outlet').then(result => {
      setOutlet(result.outlet)
      setAttendanceSettingsReady(result.attendance_settings_ready !== false)
      if (result.outlet) setForm({
        name: result.outlet.name || '',
        address: result.outlet.address || '',
        phone: result.outlet.phone || '',
        attendance_latitude: result.outlet.attendance_latitude ?? '',
        attendance_longitude: result.outlet.attendance_longitude ?? '',
        attendance_checkout_grace_minutes: result.outlet.attendance_checkout_grace_minutes ?? 30,
      })
    }).catch(reason => setError(reason.message)).finally(() => setLoading(false))
  }, [])
  const save = async event => {
    event.preventDefault()
    if (!form.name.trim()) { setError('Nama outlet wajib diisi.'); return }
    setSaving(true); setError('')
    try {
      const payload = attendanceSettingsReady ? form : { name: form.name, address: form.address, phone: form.phone }
      const result = await api('/api/owner/outlet', { method: 'PUT', body: JSON.stringify(payload) })
      setOutlet(result.outlet); notify('Informasi outlet tersimpan.')
    } catch (reason) { setError(reason.message) }
    finally { setSaving(false) }
  }
  return <div className="owner-module">
    <ModuleIntro title="Pengaturan Bisnis" description="Informasi outlet aktif dan batas konfigurasi yang tersedia."/>
    {error && <div className="owner-state error" role="alert">{error}</div>}
    {loading ? <div className="owner-state">Memuat informasi outlet…</div> : outlet ? <form className="owner-settings-form" onSubmit={save}>
      <section className="owner-module-card"><div className="module-heading"><div><h3>Informasi outlet</h3><p>Perubahan disimpan ke PostgreSQL.</p></div></div>
        <label>Nama outlet<input required maxLength="100" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
        <label>Alamat<textarea maxLength="500" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })}/></label>
        <label>Nomor telepon<input maxLength="30" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label>
        <div className="owner-module-note"><Settings2 size={16}/> Nama dan alamat dipakai untuk informasi outlet pada aplikasi.</div>
      </section>
      <section className="owner-module-card"><div className="module-heading"><div><h3>Pengaturan absensi</h3><p>Jeda pulang dan area GPS untuk akun karyawan.</p></div></div>
        {!attendanceSettingsReady && <div className="owner-state error" role="alert">Migration pengaman absensi belum diterapkan. Pengaturan lokasi dan jeda belum dapat disimpan.</div>}
        <label>Jeda minimum sebelum absen pulang (menit)<input type="number" min="0" max="240" step="1" required disabled={!attendanceSettingsReady} value={form.attendance_checkout_grace_minutes} onChange={event => setForm({ ...form, attendance_checkout_grace_minutes: event.target.value })}/></label>
        <div className="employee-location-fields">
          <label>Latitude outlet<input type="number" min="-90" max="90" step="any" disabled={!attendanceSettingsReady} value={form.attendance_latitude} onChange={event => setForm({ ...form, attendance_latitude: event.target.value })} placeholder="-6.2000000"/></label>
          <label>Longitude outlet<input type="number" min="-180" max="180" step="any" disabled={!attendanceSettingsReady} value={form.attendance_longitude} onChange={event => setForm({ ...form, attendance_longitude: event.target.value })} placeholder="106.8166667"/></label>
        </div>
        <div className="owner-module-note"><Settings2 size={16}/> Jeda awal 30 menit, dapat diatur 0–240 menit. Radius GPS tetap 100 meter. Isi kedua koordinat outlet agar karyawan bisa melakukan absensi berbasis lokasi.</div>
        <label className="employee-location-consent"><input type="checkbox" required disabled={!attendanceSettingsReady}/> Saya memastikan koordinat outlet benar dan memahami lokasi digunakan untuk memvalidasi absensi.</label>
        <button className="owner-module-button primary" disabled={saving}>{saving ? 'Menyimpan…' : attendanceSettingsReady ? 'Simpan pengaturan outlet & absensi' : 'Simpan informasi outlet'}</button>
      </section>
      <section className="owner-module-card"><div className="module-heading"><div><h3>Aturan operasional</h3><p>Informasi waktu aplikasi dan pembayaran.</p></div></div>
        <div className="owner-settings-fact"><span>Zona waktu aplikasi</span><b>Asia/Jakarta</b></div>
        <div className="owner-settings-fact"><span>Jam harga malam</span><b>23.00–05.59 WIB</b></div>
        <div className="owner-settings-fact"><span>Metode bayar POS</span><b>Tunai · QRIS</b></div>
        <div className="owner-module-note"><Settings2 size={16}/> Promo dan preferensi lainnya belum tersedia sebagai pengaturan backend.</div>
      </section>
    </form> : <EmptyState title="Outlet belum tersedia" detail="Tambahkan outlet aktif ke database sebelum mengubah informasi bisnis."/>}
  </div>
}

function ModuleIntro({ title, description }) {
  return <header className="owner-module-intro"><div><span className="owner-section-kicker">PORTAL OWNER</span><h2>{title}</h2><p>{description}</p></div></header>
}

function ModuleStat({ label, value, detail }) {
  return <article className="owner-module-stat"><small>{label}</small><b>{value}</b><span>{detail}</span></article>
}

function EmptyState({ title, detail }) {
  return <div className="owner-empty-state"><Wallet size={22}/><b>{title}</b><span>{detail}</span></div>
}

function dateTime(value) {
  return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—'
}
