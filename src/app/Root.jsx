import React, { useEffect, useState } from 'react'
import CashierApp from '../features/cashier/CashierApp'
import AttendancePage from '../features/employee/components/AttendancePage'
import OwnerPortal from '../features/owner/components/OwnerPortal'
import LoginPage from '../features/auth/LoginPage'
import { api, logout } from '../shared/api'

export default function Root() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    api('/api/auth/me').then(result => setUser(result.user)).catch(() => setUser(null))
  }, [])

  const signOut = async () => {
    try {
      await logout()
    } catch {
      setUser(null)
    }
    window.history.replaceState({}, '', '/login')
    setUser(null)
  }

  if (user === undefined) return <div className="auth-loading">Memuat KINO Laundry POS…</div>
  if (!user) {
    return <LoginPage onLogin={nextUser => {
      setUser(nextUser)
      window.history.replaceState({}, '', nextUser.role === 'owner' ? '/owner' : nextUser.role === 'kasir' ? '/kasir' : '/absensi')
    }} />
  }
  if (user.role === 'owner') return <OwnerPortal user={user} onLogout={signOut} />
  if (user.role === 'karyawan') return <AttendancePage user={user} onLogout={signOut} />
  return <CashierApp user={user} onLogout={signOut} />
}
