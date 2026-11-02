import React, { useEffect, useRef, useState } from 'react'
import { Search, ShieldCheck, Ticket, UserPlus, X } from 'lucide-react'
import { api } from '../../../shared/api'
import '../styles/membership.css'

export default function MembershipPicker({ selectedMember, onSelect, notify }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [typesError, setTypesError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', membership_type: 'REGULAR', student_verified: false })
  const createKeyRef = useRef(null)
  const handoverKeysRef = useRef(new Map())

  useEffect(() => {
    api('/api/membership/types').then(result => setTypes(result.items)).catch(reason => setTypesError(reason.message))
  }, [])
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setResults([]); setLoading(false); return undefined }
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('')
      try {
        const params = new URLSearchParams({ search: term, include_pending: '1' })
        const result = await api(`/api/membership/members?${params}`)
        if (active) setResults(result.items)
      } catch (reason) { if (active) setError(reason.message) }
      finally { if (active) setLoading(false) }
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query])

  const searchMemberByNumber = async memberNumber => {
    const params = new URLSearchParams({ search: memberNumber })
    const result = await api(`/api/membership/members?${params}`)
    return result.items.find(item => item.member_number === memberNumber)
  }
  const registerMember = async event => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const fingerprint = JSON.stringify(form)
      if (createKeyRef.current?.fingerprint !== fingerprint) createKeyRef.current = { fingerprint, key: crypto.randomUUID() }
      const result = await api('/api/membership/members', {
        method: 'POST',
        headers: { 'Idempotency-Key': createKeyRef.current.key },
        body: JSON.stringify(form),
      })
      createKeyRef.current = null
      setRegistering(false); setQuery(result.member.member_number)
      if (result.member.status === 'aktif') onSelect(result.member)
      notify(result.member.status === 'aktif' ? 'Member terdaftar dan kartu pertama diterbitkan.' : 'Pendaftaran tersimpan; verifikasi bukti diperlukan sebelum member dapat digunakan.')
    } catch (reason) { setError(reason.message) }
    finally { setSaving(false) }
  }
  const verifyStudent = async member => {
    if (!window.confirm(`Konfirmasi bukti pelajar/mahasiswa untuk ${member.name} sudah diperiksa dan valid?`)) return
    setError('')
    try {
      await api(`/api/membership/members/${member.id}/verify`, { method: 'POST', body: '{}' })
      const updated = await searchMemberByNumber(member.member_number)
      if (!updated) throw new Error('Member terverifikasi, tetapi datanya tidak ditemukan saat dimuat ulang.')
      setResults(current => current.map(item => item.id === member.id ? updated : item))
      notify('Verifikasi pelajar berhasil dicatat dan kartu awal diterbitkan.')
    } catch (reason) { setError(reason.message) }
  }
  const handoverCard = async member => {
    if (!window.confirm(`Kartu ${member.card_number} penuh. Serahkan kartu fisik untuk membuat satu kupon dan kartu baru?`)) return
    setError('')
    try {
      if (!handoverKeysRef.current.has(member.card_id)) handoverKeysRef.current.set(member.card_id, crypto.randomUUID())
      const result = await api(`/api/membership/cards/${member.card_id}/handover`, {
        method: 'POST',
        headers: { 'Idempotency-Key': handoverKeysRef.current.get(member.card_id) },
        body: '{}',
      })
      const updated = await searchMemberByNumber(member.member_number)
      if (!updated) throw new Error('Kartu berhasil diproses, tetapi data member tidak ditemukan saat dimuat ulang.')
      handoverKeysRef.current.delete(member.card_id)
      onSelect(updated)
      notify(`Kupon ${result.redemption.ticket_number} dibuat; kartu baru ${result.redemption.new_card_number} aktif.`)
    } catch (reason) { setError(reason.message) }
  }
  const selectMember = member => {
    if (member.status !== 'aktif' || member.verification_status === 'pending') return
    onSelect(member); setResults([])
  }
  const clearMember = () => { onSelect(null); setQuery('') }

  return <section className="cashier-membership-picker" aria-label="Pilih member">
    <div className="cashier-membership-heading"><div><b>Membership</b><small>Harga tetap sama; stempel hanya untuk Self Service.</small></div>
      {!selectedMember && <button type="button" className="membership-register-toggle" disabled={!types.length} onClick={() => { setError(''); setForm({ name: '', phone: '', membership_type: 'REGULAR', student_verified: false }); setRegistering(!registering) }}><UserPlus size={14}/> Daftarkan</button>}
    </div>
    {selectedMember ? <div className={`cashier-selected-member ${selectedMember.card_color}`}>
      <div className="cashier-selected-copy"><b>{selectedMember.name}</b><small>{selectedMember.member_number} · {selectedMember.membership_type}</small>
        <small>{selectedMember.card_number ? `${selectedMember.card_number} · ${selectedMember.stamp_count}/${selectedMember.stamp_slots} stempel` : 'Kartu belum diterbitkan'}</small>
        {selectedMember.stamped_today && <small className="membership-today-note">Sudah mendapat stempel hari ini.</small>}
      </div>
      <button type="button" className="membership-remove" onClick={clearMember} aria-label="Hapus pilihan member"><X size={15}/></button>
      {selectedMember.card_full && <button type="button" className="membership-handover" onClick={() => handoverCard(selectedMember)}><Ticket size={14}/> Serahkan kartu penuh</button>}
    </div> : <div className="cashier-membership-search">
      <Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama, nomor telepon, atau nomor member"/>
      {loading && <span>Memuat…</span>}
      {results.length > 0 && <div className="cashier-member-results">{results.map(member => <article key={member.id}>
        <button type="button" className="cashier-member-result" disabled={member.status !== 'aktif'} onClick={() => selectMember(member)}>
          <span><b>{member.name}</b><small>{member.member_number} · {member.phone}</small></span>
          <span className={`membership-type ${member.card_color}`}>{member.membership_type}</span>
          <small>{member.status === 'pending' ? 'Menunggu verifikasi' : member.card_id ? `${member.stamp_count}/${member.stamp_slots} stempel` : 'Kartu belum tersedia'}</small>
        </button>
        {member.verification_status === 'pending' && <button type="button" className="cashier-verify-member" onClick={() => verifyStudent(member)}><ShieldCheck size={14}/> Verifikasi bukti</button>}
      </article>)}</div>}
    </div>}
    {!selectedMember && !loading && query.trim().length >= 2 && !results.length && !error && <small className="cashier-membership-hint">Tidak ditemukan. Daftarkan member baru bila diperlukan.</small>}
    {error && <small className="cashier-membership-error" role="alert">{error}</small>}
    {typesError && <small className="cashier-membership-error" role="alert">Jenis membership tidak dapat dimuat: {typesError}</small>}
    {registering && <form className="cashier-membership-register" onSubmit={registerMember}>
      <div className="cashier-membership-register-heading"><b>Daftarkan member baru</b><button type="button" onClick={() => setRegistering(false)} aria-label="Tutup form"><X size={15}/></button></div>
      <label>Nama<input required maxLength="100" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
      <label>Nomor telepon<input required maxLength="30" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label>
      <label>Jenis<select value={form.membership_type} onChange={event => setForm({ ...form, membership_type: event.target.value, student_verified: false })}>{types.map(type => <option key={type.code} value={type.code}>{type.name} · {type.stamp_slots} stempel</option>)}</select></label>
      {form.membership_type === 'STUDENT' && <label className="cashier-membership-check"><input type="checkbox" checked={form.student_verified} onChange={event => setForm({ ...form, student_verified: event.target.checked })}/> Bukti pelajar/mahasiswa sudah diperiksa</label>}
      <button className="membership-register-submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Daftarkan member'}</button>
    </form>}
  </section>
}
