import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, RefreshCw, Search, Users } from 'lucide-react'
import { api } from '../../../shared/api'

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
  const query = useMemo(() => new URLSearchParams({ date, search, shift }).toString(), [date, search, shift])

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
      <div><span className="owner-section-kicker">OPERASIONAL</span><h2>Manajemen Karyawan & Shift</h2><p>Lihat catatan absensi aktual. Halaman ini tidak mengubah data kehadiran.</p></div>
      <button className="owner-action soft" onClick={load} disabled={loading}><RefreshCw size={16}/> Muat ulang</button>
    </header>
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
        <label>Shift <select value={shift} onChange={event => setShift(event.target.value)}><option value="">Semua shift</option><option value="pagi">Pagi</option><option value="siang">Siang</option><option value="malam">Malam</option></select></label>
      </div>
      {error && <div className="owner-state error" role="alert">{error}</div>}
      <div className="owner-module-table owner-responsive-table"><table><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Shift</th><th>Waktu masuk</th><th>Waktu pulang</th><th>Status</th></tr></thead><tbody>{data?.items.map(row =>
        <tr key={row.user_id}><td><b>{row.name}</b><small>{row.role}</small></td><td>{row.work_date || date}</td><td>{row.shift_type || '—'}</td><td>{formatTime(row.check_in_at)}</td><td>{formatTime(row.check_out_at)}</td><td><span className={`owner-attendance-status ${row.status || 'none'}`}>{statusLabel(row)}</span></td></tr>
      )}</tbody></table>
      {loading && <div className="owner-state">Memuat catatan kehadiran…</div>}
      {!loading && !error && !data?.items.length && <div className="owner-empty-state"><Users size={22}/><b>Tidak ada karyawan pada filter ini</b><span>Ubah filter pencarian atau tambahkan akun kasir/karyawan.</span></div>}
      </div>
    </section>
  </section>
}

function SummaryCard({ label, value }) {
  return <article className="owner-module-stat"><small>{label}</small><b>{value}</b><span>Data berdasarkan filter aktif</span></article>
}
