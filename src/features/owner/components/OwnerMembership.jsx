import React, { useEffect, useRef, useState } from 'react'
import { Check, Download, History, Pencil, Plus, Search, ShieldCheck, Ticket, X } from 'lucide-react'
import { api } from '../../../shared/api'
import '../styles/membership.css'

const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
const dateTime = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—'
const csvCell = value => {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export default function OwnerMembership({ notify }) {
  const [tab, setTab] = useState('members')
  const [members, setMembers] = useState([])
  const [cards, setCards] = useState([])
  const [coupons, setCoupons] = useState([])
  const [types, setTypes] = useState([])
  const [typesError, setTypesError] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', membership_type: 'REGULAR', student_verified: false })
  const [saving, setSaving] = useState(false)
  const createKeyRef = useRef(null)
  const handoverKeysRef = useRef(new Map())

  const loadTypes = async () => {
    const result = await api('/api/membership/types')
    setTypes(result.items)
  }
  const loadMembers = async (term = appliedSearch) => {
    const params = new URLSearchParams()
    if (term) params.set('search', term)
    const queryString = params.toString()
    const result = await api(`/api/membership/members${queryString ? `?${queryString}` : ''}`)
    setMembers(result.items)
  }
  const loadCards = async () => setCards((await api('/api/owner/membership/cards')).items)
  const loadCoupons = async () => setCoupons((await api('/api/owner/membership/coupons')).items)
  const reload = async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'members') await loadMembers()
      if (tab === 'cards') await loadCards()
      if (tab === 'coupons') await loadCoupons()
    } catch (reason) { setError(reason.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadTypes().catch(reason => setTypesError(reason.message)) }, [])
  useEffect(() => { reload() }, [tab, appliedSearch])

  const saveMember = async event => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      if (editor?.kind === 'edit') {
        await api(`/api/owner/membership/members/${editor.member.id}`, { method: 'PATCH', body: JSON.stringify({ name: form.name, phone: form.phone }) })
        notify('Data member berhasil diperbarui.')
      } else {
        const fingerprint = JSON.stringify(form)
        if (createKeyRef.current?.fingerprint !== fingerprint) createKeyRef.current = { fingerprint, key: crypto.randomUUID() }
        await api('/api/membership/members', {
          method: 'POST',
          headers: { 'Idempotency-Key': createKeyRef.current.key },
          body: JSON.stringify(form),
        })
        createKeyRef.current = null
        notify('Pendaftaran member berhasil disimpan.')
      }
      setEditor(null); await loadMembers()
    } catch (reason) { setError(reason.message) }
    finally { setSaving(false) }
  }
  const editMember = member => {
    setForm({ name: member.name, phone: member.phone || '', membership_type: member.membership_type_code, student_verified: false })
    setEditor({ kind: 'edit', member })
  }
  const createMember = () => {
    setForm({ name: '', phone: '', membership_type: 'REGULAR', student_verified: false })
    setEditor({ kind: 'create' })
  }
  const verifyMember = async member => {
    setError('')
    try {
      await api(`/api/membership/members/${member.id}/verify`, { method: 'POST', body: '{}' })
      notify('Verifikasi pelajar berhasil dicatat dan kartu awal diterbitkan.')
      await loadMembers()
    } catch (reason) { setError(reason.message) }
  }
  const setMemberStatus = async (member, status) => {
    setError('')
    try {
      await api(`/api/owner/membership/members/${member.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      notify(status === 'aktif' ? 'Member diaktifkan.' : 'Member dinonaktifkan.')
      await loadMembers()
    } catch (reason) { setError(reason.message) }
  }
  const openHistory = async member => {
    setHistory({ member, items: [] }); setHistoryLoading(true); setError('')
    try {
      const result = await api(`/api/owner/membership/members/${member.id}/transactions`)
      setHistory({ member, items: result.items })
    } catch (reason) { setError(reason.message) }
    finally { setHistoryLoading(false) }
  }
  const handoverCard = async card => {
    if (!window.confirm(`Konfirmasi penyerahan kartu penuh ${card.card_number}? Sistem akan menghasilkan satu kupon dan menerbitkan kartu baru.`)) return
    setError('')
    try {
      if (!handoverKeysRef.current.has(card.id)) handoverKeysRef.current.set(card.id, crypto.randomUUID())
      const result = await api(`/api/membership/cards/${card.id}/handover`, {
        method: 'POST',
        headers: { 'Idempotency-Key': handoverKeysRef.current.get(card.id) },
        body: '{}',
      })
      await Promise.all([loadCards(), loadMembers()])
      handoverKeysRef.current.delete(card.id)
      notify(`Kupon ${result.redemption.ticket_number} dibuat. Kartu baru ${result.redemption.new_card_number} diterbitkan.`)
    } catch (reason) { setError(reason.message) }
  }
  const exportCoupons = () => {
    const rows = [
      ['Nomor kupon', 'Nama pemilik', 'Nomor member', 'Jenis membership', 'Nomor kartu', 'Tanggal penyerahan'],
      ...coupons.map(item => [item.ticket_number, item.name, item.member_number, item.membership_type, item.card_number, dateTime(item.issued_at)]),
    ]
    const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'rekap-kupon-undian-kino.csv'; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="owner-membership">
    <header className="membership-page-heading">
      <div><span className="membership-kicker">PROGRAM PELANGGAN</span><h1>Membership KINO</h1><p>Kelola member, kartu fisik, penyerahan, dan daftar kupon undian.</p></div>
      <div className="membership-summary"><b>{members.length}</b><span>member dalam hasil</span></div>
    </header>
    <nav className="membership-tabs" aria-label="Bagian membership">
      <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>Manajemen member</button>
      <button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>Kartu fisik</button>
      <button className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}>Rekap undian</button>
    </nav>
    {error && <div className="membership-error" role="alert">{error}</div>}
    {typesError && <div className="membership-error" role="alert">Jenis membership tidak dapat dimuat: {typesError}</div>}
    {tab === 'members' && <section className="membership-panel">
      <div className="membership-toolbar">
        <form className="membership-search" onSubmit={event => { event.preventDefault(); setAppliedSearch(search.trim()) }}>
          <Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama, telepon, atau nomor member"/>
          <button type="submit">Cari</button>
        </form>
        <button className="membership-primary" onClick={createMember} disabled={!types.length}><Plus size={16}/> Tambah member</button>
      </div>
      {loading ? <div className="membership-empty">Memuat data member…</div> : !members.length ? <div className="membership-empty">Belum ada data member yang sesuai.</div> :
        <div className="membership-table-wrap"><table className="membership-table"><thead><tr><th>Member</th><th>Jenis</th><th>Status</th><th>Kartu aktif</th><th>Stempel</th><th>Aksi</th></tr></thead><tbody>
          {members.map(member => <tr key={member.id}>
            <td><b>{member.name}</b><small>{member.member_number} · {member.phone}</small></td>
            <td><span className={`membership-type ${member.card_color}`}>{member.membership_type}</span></td>
            <td><span className={`membership-status ${member.status}`}>{member.verification_status === 'pending' ? 'Menunggu verifikasi' : member.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</span></td>
            <td>{member.card_number || 'Belum diterbitkan'}{member.card_number && <small>{member.stamped_today ? 'Sudah mendapat stempel hari ini' : 'Belum mendapat stempel hari ini'}</small>}</td>
            <td>{member.card_id ? <StampProgress count={member.stamp_count} slots={member.stamp_slots} color={member.card_color}/> : '—'}</td>
            <td><div className="membership-row-actions">
              {member.verification_status === 'pending' && <button title="Verifikasi pelajar" onClick={() => verifyMember(member)}><ShieldCheck size={15}/></button>}
              <button title="Riwayat Self Service" onClick={() => openHistory(member)}><History size={15}/></button>
              <button title="Ubah data" onClick={() => editMember(member)}><Pencil size={15}/></button>
              {member.status === 'aktif'
                ? <button className="danger" title="Nonaktifkan member" onClick={() => setMemberStatus(member, 'nonaktif')}><X size={15}/></button>
                : member.status === 'nonaktif' && <button title="Aktifkan member" onClick={() => setMemberStatus(member, 'aktif')}><Check size={15}/></button>}
            </div></td>
          </tr>)}
        </tbody></table></div>}
    </section>}
    {tab === 'cards' && <section className="membership-panel">
      <div className="membership-panel-heading"><div><h2>Riwayat kartu membership</h2><p>Kartu penuh hanya dapat diserahkan satu kali. Kupon dan kartu baru dibuat dalam satu proses.</p></div><button className="membership-secondary" onClick={reload}>Muat ulang</button></div>
      {loading ? <div className="membership-empty">Memuat kartu…</div> : !cards.length ? <div className="membership-empty">Belum ada kartu yang diterbitkan.</div> :
        <div className="membership-table-wrap"><table className="membership-table"><thead><tr><th>Kartu</th><th>Pemilik</th><th>Progres</th><th>Status</th><th>Terbit / serah</th><th>Undian</th><th/></tr></thead><tbody>
          {cards.map(card => <tr key={card.id}>
            <td><b>{card.card_number}</b><small>{card.member_number}</small></td>
            <td>{card.name}<small><span className={`membership-type ${card.card_color}`}>{card.membership_type}</span></small></td>
            <td><StampProgress count={card.stamp_count} slots={card.stamp_slots} color={card.card_color}/></td>
            <td><span className={`membership-status ${card.status}`}>{card.status === 'aktif' ? 'Aktif' : 'Diserahkan'}</span></td>
            <td>{dateTime(card.issued_at)}<small>{card.handed_over_at ? `Diserahkan ${dateTime(card.handed_over_at)}` : 'Belum diserahkan'}</small></td>
            <td>{card.ticket_number || '—'}</td>
            <td>{card.status === 'aktif' && Number(card.stamp_count) >= Number(card.stamp_slots) && <button className="membership-primary compact" onClick={() => handoverCard(card)}><Ticket size={15}/> Serahkan & terbitkan</button>}</td>
          </tr>)}
        </tbody></table></div>}
    </section>}
    {tab === 'coupons' && <section className="membership-panel">
      <div className="membership-panel-heading"><div><h2>Peserta undian</h2><p>Satu kupon dihasilkan untuk setiap kartu penuh yang diserahkan. Pengundian pemenang dilakukan oleh Owner di luar sistem.</p></div><button className="membership-primary" onClick={exportCoupons} disabled={!coupons.length}><Download size={15}/> Unduh CSV</button></div>
      {loading ? <div className="membership-empty">Memuat daftar kupon…</div> : !coupons.length ? <div className="membership-empty">Belum ada kupon undian.</div> :
        <div className="membership-table-wrap"><table className="membership-table"><thead><tr><th>Nomor kupon</th><th>Pemilik</th><th>Jenis membership</th><th>Kartu yang diserahkan</th><th>Tanggal penyerahan</th></tr></thead><tbody>
          {coupons.map(item => <tr key={item.id}><td><b>{item.ticket_number}</b></td><td>{item.name}<small>{item.member_number} · {item.phone}</small></td><td><span className={`membership-type ${item.card_color}`}>{item.membership_type}</span></td><td>{item.card_number}</td><td>{dateTime(item.issued_at)}</td></tr>)}
        </tbody></table></div>}
    </section>}

    {editor && <div className="membership-overlay" onMouseDown={event => event.target === event.currentTarget && !saving && setEditor(null)}>
      <form className="membership-dialog" onSubmit={saveMember}>
        <header><div><h2>{editor.kind === 'edit' ? 'Ubah data member' : 'Pendaftaran member'}</h2><p>{editor.kind === 'edit' ? editor.member.member_number : 'Reguler langsung aktif; pelajar perlu verifikasi petugas.'}</p></div><button type="button" onClick={() => setEditor(null)} aria-label="Tutup"><X size={18}/></button></header>
        <label>Nama lengkap<input required maxLength="100" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
        <label>Nomor telepon<input required maxLength="30" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label>
        {editor.kind === 'create' && <label>Jenis membership<select value={form.membership_type} onChange={event => setForm({ ...form, membership_type: event.target.value })}>{types.map(type => <option key={type.code} value={type.code}>{type.name} · {type.stamp_slots} stempel</option>)}</select></label>}
        {editor.kind === 'create' && form.membership_type === 'STUDENT' && <label className="membership-checkbox"><input type="checkbox" checked={form.student_verified} onChange={event => setForm({ ...form, student_verified: event.target.checked })}/> Bukti pelajar/mahasiswa sudah diperiksa dan valid</label>}
        <footer><button type="button" className="membership-secondary" onClick={() => setEditor(null)} disabled={saving}>Batal</button><button className="membership-primary" disabled={saving}>{saving ? 'Menyimpan…' : editor.kind === 'edit' ? 'Simpan perubahan' : 'Daftarkan member'}</button></footer>
      </form>
    </div>}
    {history && <div className="membership-overlay" onMouseDown={event => event.target === event.currentTarget && setHistory(null)}>
      <section className="membership-dialog membership-history-dialog">
        <header><div><h2>Riwayat Self Service</h2><p>{history.member.name} · {history.member.member_number}</p></div><button onClick={() => setHistory(null)} aria-label="Tutup"><X size={18}/></button></header>
        {historyLoading ? <div className="membership-empty">Memuat riwayat…</div> : !history.items.length ? <div className="membership-empty">Belum ada transaksi Self Service aktif.</div> :
          <div className="membership-history-list">{history.items.map(item => <article key={item.id}><div><b>{item.transaction_number}</b><small>{dateTime(item.created_at)}</small></div><b>{money(item.total)}</b><small>Status pembayaran: {item.payment_status}</small>{Array.isArray(item.items) && item.items.map((line, index) => <small key={index}>{line.description} · {line.weight_kg} kg · {line.washer_machine_count || 0} washer / {line.dryer_machine_count || 0} dryer</small>)}</article>)}</div>}
      </section>
    </div>}
  </section>
}

function StampProgress({ count, slots, color }) {
  const current = Number(count || 0); const total = Number(slots || 0)
  return <div className={`membership-progress ${color}`} aria-label={`${current} dari ${total} stempel`}>
    <div><span>{current}/{total} stempel</span><b>{total > 0 ? Math.min(100, Math.round(current / total * 100)) : 0}%</b></div>
    <span className="membership-progress-track"><i style={{ width: `${total > 0 ? Math.min(100, current / total * 100) : 0}%` }}/></span>
  </div>
}
