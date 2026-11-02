import React, { useEffect, useRef, useState } from 'react'
import { BarChart3, Check, FileSpreadsheet, LayoutDashboard, LogOut, Moon, Settings2, SlidersHorizontal, Sun, Ticket, Users, WashingMachine } from 'lucide-react'
import OwnerDashboard from './OwnerDashboard'
import OwnerModule from './OwnerModule'
import AttendanceAdmin from './AttendanceAdmin'

const navigation = [
  { name: 'Dashboard Owner', label: 'Ringkasan', icon: LayoutDashboard },
  { name: 'Manajemen Membership', label: 'Membership', icon: Ticket },
  { name: 'Laporan Keuangan', label: 'Laporan Keuangan', icon: BarChart3 },
  { name: 'Manajemen Karyawan & Shift', label: 'Karyawan & Shift', icon: Users },
  { name: 'Manajemen Harga & Promo', label: 'Harga & Promo', icon: SlidersHorizontal },
  { name: 'Integrasi Google Sheets', label: 'Integrasi', icon: FileSpreadsheet },
  { name: 'Pengaturan Bisnis', label: 'Pengaturan', icon: Settings2 },
]

export default function OwnerPortal({ user, onLogout }) {
  const [active, setActive] = useState('Dashboard Owner')
  const [dark, setDark] = useState(() => window.localStorage.getItem('kino-owner-theme') === 'dark')
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(null)
  const notify = message => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setToast('')
      toastTimerRef.current = null
    }, 5000)
  }
  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
  }, [])
  const choose = name => setActive(name)
  const toggleTheme = () => {
    const value = !dark
    setDark(value)
    window.localStorage.setItem('kino-owner-theme', value ? 'dark' : 'light')
  }
  const activePage = navigation.find(item => item.name === active)

  return <div className={`owner-portal ${dark ? 'dark' : ''}`}>
    <div className="owner-reference-layout">
      <aside className="owner-reference-rail" aria-label="Navigasi Owner">
        <button className="owner-rail-button" onClick={toggleTheme} aria-label="Ubah tema" title="Ubah tema">
          {dark ? <Sun size={18}/> : <Moon size={18}/>}
        </button>
        <span className="owner-rail-divider"/>
        <nav>
          {navigation.map(item => {
            const Icon = item.icon
            return <button key={item.name} className={`owner-rail-button ${active === item.name ? 'active' : ''}`} onClick={() => choose(item.name)} aria-label={item.label} aria-current={active === item.name ? 'page' : undefined} title={item.label}>
              <Icon size={18} strokeWidth={1.8}/>
            </button>
          })}
        </nav>
        <button className="owner-rail-button owner-rail-logout" onClick={onLogout} aria-label="Keluar dari akun" title="Keluar dari akun"><LogOut size={18}/></button>
      </aside>

      <main className="owner-main">
        <header className="owner-topbar">
          <div className="owner-reference-brand">
            <span className="owner-reference-brand-mark"><WashingMachine size={17}/></span>
            <span><b>KINO</b><small>OWNER POS</small></span>
          </div>
          <nav className="owner-reference-nav" aria-label="Navigasi utama Owner">
            {navigation.map(item => <button key={item.name} className={active === item.name ? 'active' : ''} onClick={() => choose(item.name)} aria-current={active === item.name ? 'page' : undefined}>{item.label}</button>)}
          </nav>
          <button className="owner-mobile-theme" onClick={toggleTheme} aria-label="Ubah tema" title="Ubah tema">
            {dark ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
          <div className="owner-reference-profile">
            <span className="owner-user-icon">{(user?.name || 'O').slice(0, 1)}</span>
            <span><b>{user?.name || 'Owner'}</b><small>Owner</small></span>
          </div>
        </header>

        <div className="owner-content">
          {active === 'Dashboard Owner'
            ? <OwnerDashboard user={user} onNavigate={choose} notify={notify}/>
            : active === 'Manajemen Karyawan & Shift'
              ? <AttendanceAdmin/>
              : <OwnerModule page={active} notify={notify}/>}
        </div>
        <footer className="owner-footer"><span>Operasional outlet KINO Laundry</span><span>{activePage?.label || 'Ringkasan'} <b>·</b> KINO Laundry POS</span></footer>
      </main>
    </div>
    {toast && <div className="owner-toast"><span><Check size={13}/></span>{toast}</div>}
  </div>
}
