import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, Eye, EyeOff, History, KeyRound, Pencil, Plus, RefreshCw, Search, UserPlus, Users, X } from 'lucide-react'
import { api } from '../../../shared/api'
import '../styles/employee-management.css'

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

export default function AttendanceAdmin() {
  const [date, setDate] = useState(today)
  const [search, setSearch] = useState('')
  const [shift, setShift] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [employeeLoading, setEmployeeLoading] = useState(true)
  const [employeeError, setEmployeeError] = useState('')
  const [employeeSuccess, setEmployeeSuccess] = useState('')
  const [employeeSaving, setEmployeeSaving] = useState(false)
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [employeeForm, setEmployeeForm] = useState({ name: '', username: '', email: '', password: '', confirmPassword: '' })
  const [historyTarget, setHistoryTarget] = useState(null)
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [correctionTarget, setCorrectionTarget] = useState(null)
  const [correctionTime, setCorrectionTime] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [correctionSaving, setCorrectionSaving] = useState(false)
  const [now, setNow] = useState(Date.now())
  const query = useMemo(() => new URLSearchParams({ date, search, shift }).toString(), [date, search, shift])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])
  const load = () => {
    setLoading(true); setError(''); setData(null)
    api(`/api/attendance?${query}`)
      .then(result => setData(result))
      .catch(reason => setError(reason.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setData(null)
    api(`/api/attendance?${query}`)
      .then(result => { if (active) setData(result) })
      .catch(reason => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])
  useEffect(() => {
    let active = true
    api('/api/owner/employees')
      .then(result => { if (active) setEmployees(result.items || []) })
      .catch(reason => { if (active) setEmployeeError(reason.message) })
      .finally(() => { if (active) setEmployeeLoading(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!historyTarget) return undefined
    let active = true
    setHistoryLoading(true)
    setHistoryError('')
    api(`/api/attendance/${historyTarget.attendance_id}/history`)
      .then(result => { if (active) setHistoryItems(result.items || []) })
      .catch(reason => { if (active) setHistoryError(reason.message) })
      .finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [historyTarget])

  const refreshEmployees = () => {
    setEmployeeLoading(true)
    setEmployeeError('')
    api('/api/owner/employees')
      .then(result => setEmployees(result.items || []))
      .catch(reason => setEmployeeError(reason.message))
      .finally(() => setEmployeeLoading(false))
  }
  const updateEmployeeForm = event => {
    const { name, value } = event.target
    setEmployeeForm(current => ({ ...current, [name]: value }))
    setEmployeeError('')
    setEmployeeSuccess('')
  }
  const createEmployee = async event => {
    event.preventDefault()
    if (employeeSaving) return
    if (employeeForm.password !== employeeForm.confirmPassword) {
      setEmployeeError('Konfirmasi kata sandi tidak sama.')
      return
    }
    setEmployeeSaving(true)
    setEmployeeError('')
    setEmployeeSuccess('')
    try {
      const result = await api('/api/owner/employees', {
        method: 'POST',
        body: JSON.stringify({
          name: employeeForm.name,
          username: employeeForm.username,
          email: employeeForm.email,
          password: employeeForm.password,
        }),
      })
      setEmployees(current => [...current, result.user].sort((a, b) => a.name.localeCompare(b.name, 'id')))
      setEmployeeSuccess(`Akun ${result.user.username} berhasil dibuat dengan akses absensi karyawan.`)
      setEmployeeForm({ name: '', username: '', email: '', password: '', confirmPassword: '' })
      setShowPassword(false)
      setEmployeeFormOpen(false)
      load()
    } catch (reason) {
      setEmployeeError(reason.message)
    } finally {
      setEmployeeSaving(false)
    }
  }
  const saveCorrection = async event => {
    event.preventDefault()
    if (!correctionTarget || correctionSaving) return
    setCorrectionSaving(true)
    setError('')
    try {
      const correctedAt = new Date(`${correctionTime}:00+07:00`)
      await api(`/api/owner/attendance/${correctionTarget.attendance_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ check_out_at: correctedAt.toISOString(), reason: correctionReason }),
      })
      setCorrectionTarget(null)
      setCorrectionReason('')
      setCorrectionTime('')
      load()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setCorrectionSaving(false)
    }
  }

  const summary = data?.summary
  const formatTime = value => value ? new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(value)) : '—'
  const statusLabel = row => {
    if (!row.attendance_id) return 'Belum check-in'
    return ({ hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha' })[row.status] || row.status
  }

  return <section className="owner-module owner-attendance-page">
    <header className="owner-module-intro">
      <div><span className="owner-section-kicker">OPERASIONAL</span><h2>Manajemen Karyawan & Shift</h2><p>Buat akun karyawan khusus absensi dan lihat catatan kehadiran aktual.</p></div>
      <div className="employee-header-actions">
        <button className="owner-action primary employee-add-button" onClick={() => setEmployeeFormOpen(open => !open)} aria-expanded={employeeFormOpen} aria-controls="employee-create-form">
          {employeeFormOpen ? <X size={16}/> : <Plus size={16}/>} {employeeFormOpen ? 'Tutup' : 'Tambah karyawan'}
        </button>
        <button className="owner-action soft employee-refresh-button" onClick={() => { load(); refreshEmployees() }} disabled={loading || employeeLoading}><RefreshCw size={16}/> Muat ulang</button>
      </div>
    </header>
    <section className="owner-module-card employee-management-card">
      <div className="employee-section-heading">
        <div><span className="employee-section-icon"><UserPlus size={18}/></span><div><h3>Akun karyawan</h3><p>Akun baru hanya mendapat akses absensi, bukan akses Owner atau Kasir.</p></div></div>
        <span className="employee-count">{employees.length} akun</span>
      </div>
      {employeeFormOpen && <form id="employee-create-form" className="employee-create-form" onSubmit={createEmployee}>
        <label>Nama karyawan
          <input name="name" value={employeeForm.name} onChange={updateEmployeeForm} maxLength={100} autoComplete="name" required/>
        </label>
        <label>Nama pengguna
          <input name="username" value={employeeForm.username} onChange={updateEmployeeForm} minLength={3} maxLength={50} autoComplete="username" pattern="[A-Za-z0-9._-]{3,50}" title="Gunakan 3–50 huruf, angka, titik, garis bawah, atau tanda hubung." required/>
        </label>
        <label>Email <span>(opsional)</span>
          <input name="email" type="email" value={employeeForm.email} onChange={updateEmployeeForm} maxLength={100} autoComplete="email"/>
        </label>
        <label>Kata sandi awal
          <span className="employee-password-field">
            <KeyRound size={16}/>
            <input name="password" type={showPassword ? 'text' : 'password'} value={employeeForm.password} onChange={updateEmployeeForm} minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="employee-password-hint" required/>
            <button type="button" className="employee-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </span>
          <small id="employee-password-hint">Minimal 12 karakter. Sampaikan langsung kepada karyawan.</small>
        </label>
        <label>Konfirmasi kata sandi
          <input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={employeeForm.confirmPassword} onChange={updateEmployeeForm} minLength={12} maxLength={128} autoComplete="new-password" required/>
        </label>
        <div className="employee-form-action">
          <button type="submit" className="owner-action primary" disabled={employeeSaving}><Plus size={16}/>{employeeSaving ? 'Membuat akun…' : 'Buat akun karyawan'}</button>
        </div>
      </form>}
      {employeeError && <div className="employee-feedback error" role="alert">{employeeError}</div>}
      {employeeSuccess && <div className="employee-feedback success" role="status">{employeeSuccess}</div>}
      <div className="owner-module-table owner-responsive-table employee-account-table">
        <table><thead><tr><th>Nama</th><th>Nama pengguna</th><th>Email</th><th>Status akun</th></tr></thead><tbody>
          {employees.map(employee => <tr key={employee.id}>
            <td><b>{employee.name}</b></td><td>{employee.username}</td><td>{employee.email || '—'}</td>
            <td><span className={`employee-account-status ${employee.is_active ? 'active' : 'inactive'}`}>{employee.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
          </tr>)}
        </tbody></table>
        {employeeLoading && <div className="owner-state">Memuat akun karyawan…</div>}
        {!employeeLoading && !employeeError && !employees.length && <div className="owner-empty-state"><Users size={22}/><b>Belum ada akun karyawan</b><span>Buat akun untuk mulai menggunakan halaman absensi.</span></div>}
      </div>
    </section>
    <section className="owner-module-stats">
      <SummaryCard label="Karyawan sesuai filter" value={summary?.employees ?? '—'}/>
      <SummaryCard label="Hadir" value={summary?.present ?? '—'}/>
      <SummaryCard label="Belum check-in" value={summary?.not_checked_in ?? '—'}/>
      <SummaryCard label="Izin / sakit / alpha tercatat" value={summary?.leave ?? '—'}/>
    </section>
    <div className="owner-module-note"><Users size={16}/> Sistem belum mencatat aturan keterlambatan. Tidak ada angka terlambat yang diasumsikan.</div>
    <section className="owner-module-card">
      <div className="owner-attendance-filters">
        <label>Tanggal <span><CalendarDays size={15}/><input type="date" value={date} onChange={event => setDate(event.target.value)}/></span></label>
        <label className="owner-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama karyawan"/></label>
        <label>Shift <select value={shift} onChange={event => setShift(event.target.value)}><option value="">Semua shift</option><option value="pagi">Pagi</option><option value="siang">Siang</option><option value="sore">Sore</option><option value="malam">Malam</option></select></label>
      </div>
      {error && <div className="owner-state error" role="alert">{error}</div>}
      <div className="owner-module-table owner-responsive-table"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Shift</th><th>Waktu masuk</th><th>Waktu pulang / alasan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data?.items.map(row =>
        <tr key={row.attendance_id || `${row.user_id}-no-attendance`}><td><b>{row.name}</b><small>{row.role}</small></td><td>{row.work_date || date}</td><td>{row.shift_type || '—'}</td><td>{formatTime(row.check_in_at)}</td><td>{formatTime(row.check_out_at)}{row.checkout_reason && <small>Alasan: {row.checkout_reason}</small>}</td><td><span className={`owner-attendance-status ${row.status || 'none'}`}>{statusLabel(row)}</span>{Number(row.cancellation_count)>0 && <small>{row.cancellation_count}× pembatalan tercatat</small>}</td><td>{row.attendance_id ? <div className="attendance-row-actions">
          <button type="button" className="owner-text-action" onClick={() => setHistoryTarget(row)}><History size={14}/>Riwayat</button>
          {row.check_out_at && now-new Date(row.check_out_at).getTime()>=120000 && <button type="button" className="owner-text-action" onClick={() => { setCorrectionTarget(row); setCorrectionTime(dateTimeLocal(row.check_out_at)) }}><Pencil size={14}/>Koreksi</button>}
        </div> : '—'}</td></tr>
      )}</tbody></table>
      {loading && <div className="owner-state">Memuat catatan kehadiran…</div>}
      {!loading && !error && !data?.items.length && <div className="owner-empty-state"><Users size={22}/><b>Tidak ada karyawan pada filter ini</b><span>Ubah filter pencarian atau tambahkan akun karyawan.</span></div>}
      </div>
    </section>
    {historyTarget && <div className="attendance-owner-modal-backdrop" onMouseDown={event => event.target===event.currentTarget&&setHistoryTarget(null)}>
      <section className="attendance-owner-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-history-title">
        <header><div><h3 id="attendance-history-title">Riwayat absensi</h3><p>{historyTarget.name} · Shift {historyTarget.shift_type}</p></div><button type="button" aria-label="Tutup riwayat" onClick={() => setHistoryTarget(null)}><X size={18}/></button></header>
        {historyError&&<div className="owner-state error" role="alert">{historyError}</div>}
        {historyLoading?<div className="owner-state">Memuat riwayat…</div>:<div className="attendance-event-list">{historyItems.map(item=><article key={item.id}>
          <span className={`attendance-event-dot ${item.event_type}`}/>
          <div><b>{eventLabel(item.event_type)}</b><small>{dateTime(item.occurred_at)} · {item.actor}</small>
            {(item.attendance_time_before||item.attendance_time_after)&&<p>Waktu: {formatTime(item.attendance_time_before)}{item.attendance_time_before&&item.attendance_time_after?' → ':''}{item.attendance_time_after?formatTime(item.attendance_time_after):''}</p>}
            {item.reason&&<p>Alasan: {item.reason}</p>}
            {item.latitude!==null&&item.longitude!==null&&<p>Lokasi tercatat · akurasi {Math.round(Number(item.accuracy_meters))} m</p>}
            {item.photo_available&&<a href={`/api/attendance/events/${item.id}/photo`} target="_blank" rel="noreferrer">Lihat selfie privat</a>}
          </div>
        </article>)}</div>}
      </section>
    </div>}
    {correctionTarget && <div className="attendance-owner-modal-backdrop" onMouseDown={event => event.target===event.currentTarget&&!correctionSaving&&setCorrectionTarget(null)}>
      <form className="attendance-owner-modal attendance-correction-form" onSubmit={saveCorrection}>
        <header><div><h3>Koreksi waktu pulang</h3><p>{correctionTarget.name} · Shift {correctionTarget.shift_type}</p></div><button type="button" aria-label="Tutup koreksi" disabled={correctionSaving} onClick={() => setCorrectionTarget(null)}><X size={18}/></button></header>
        <p className="attendance-correction-note"><Clock3 size={16}/> Koreksi hanya tersedia setelah jendela pembatalan dua menit berakhir. Perubahan dicatat di riwayat.</p>
        <label>Waktu pulang yang benar<input type="datetime-local" value={correctionTime} min={dateTimeLocal(correctionTarget.check_in_at)} max={dateTimeLocal(new Date(now).toISOString())} onChange={event => setCorrectionTime(event.target.value)} required/></label>
        <label>Alasan koreksi<input value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} maxLength={500} required placeholder="Wajib untuk audit"/></label>
        {error&&<div className="owner-state error" role="alert">{error}</div>}
        <div className="attendance-correction-actions"><button type="button" className="owner-action soft" disabled={correctionSaving} onClick={() => setCorrectionTarget(null)}>Batal</button><button type="submit" className="owner-action primary" disabled={correctionSaving}>{correctionSaving?'Menyimpan…':'Simpan koreksi'}</button></div>
      </form>
    </div>}
  </section>
}

function SummaryCard({ label, value }) {
  return <article className="owner-module-stat"><small>{label}</small><b>{value}</b><span>Data berdasarkan filter aktif</span></article>
}

function eventLabel(type) {
  return ({ check_in: 'Absen masuk', check_out: 'Absen pulang', checkout_cancelled: 'Absen pulang dibatalkan', owner_correction: 'Koreksi oleh Owner' })[type] || type
}

function dateTime(value) {
  return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—'
}

function dateTimeLocal(value) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const part = type => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
