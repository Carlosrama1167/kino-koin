import React,{useEffect,useState} from 'react'
import { CalendarCheck, Clock3, LogOut, WashingMachine } from 'lucide-react'
import { api, logout } from '../../../shared/api'
import '../../../shared/styles/entry.css'
export default function AttendancePage({user,onLogout}){
 const [record,setRecord]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const refresh=()=>api('/api/attendance/me').then(r=>setRecord(r.attendance)).catch(e=>setError(e.message))
 useEffect(()=>{refresh()},[])
 const act=async type=>{setBusy(true);setError('');try{const r=await api(`/api/attendance/${type}`,{method:'POST',body:'{}'});setRecord(r.attendance)}catch(e){setError(e.message)}finally{setBusy(false)}}
 const date=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date())
 const time=v=>v?new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(v)):'—'
 return <main className="owner-login-page"><section className="owner-login-card attendance-card"><div className="attendance-head"><span className="attendance-mark"><WashingMachine/></span><span><b>KINO LAUNDRY</b><small>ABSENSI KARYAWAN</small></span><button onClick={async()=>{try{await logout()}finally{onLogout()}}}><LogOut size={16}/> Keluar</button></div><div className="attendance-body"><div className="owner-form-kicker">HALO, {user.name.toLocaleUpperCase('id-ID')}</div><h1>Absensi hari ini</h1><p><CalendarCheck size={16}/> {date}</p>{error&&<div className="owner-login-notice">{error}</div>}<section className="attendance-times"><div><small>MASUK</small><b>{time(record?.check_in_at)}</b></div><div><small>PULANG</small><b>{time(record?.check_out_at)}</b></div></section>{!record?<button disabled={busy} className="owner-signin-button attendance-action" onClick={()=>act('check-in')}><Clock3 size={18}/> Catat jam masuk</button>:!record.check_out_at?<button disabled={busy} className="owner-signin-button attendance-action" onClick={()=>act('check-out')}><Clock3 size={18}/> Catat jam pulang</button>:<div className="attendance-done">Absensi hari ini sudah lengkap.</div>}<small className="attendance-hint">Waktu dicatat oleh server menggunakan zona Asia/Jakarta.</small></div></section></main>
}
