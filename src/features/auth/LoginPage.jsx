import React, { useState } from 'react'
import { Eye, EyeOff, Moon, Sun, WashingMachine } from 'lucide-react'
import { login } from '../../shared/api'

export default function LoginPage({ onLogin }) {
  const [dark, setDark] = useState(() => {
    const savedTheme = window.localStorage.getItem('kino-login-theme')
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await login(identity, password)
      onLogin(result.user)
    } catch (reason) {
      const message = reason.message || ''
      setError(
        /nama pengguna.*kata sandi/i.test(message)
          ? 'Nama pengguna atau kata sandi salah.'
          : message === 'Failed to fetch'
            ? 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.'
            : message,
      )
    } finally {
      setBusy(false)
    }
  }

  const updateCapsLock = event => setCapsLock(event.getModifierState('CapsLock'))
  const toggleTheme = () => {
    const nextTheme = !dark
    setDark(nextTheme)
    window.localStorage.setItem('kino-login-theme', nextTheme ? 'dark' : 'light')
  }

  return (
    <main className={`login-screen ${dark ? 'dark' : ''}`}>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card-header">
          <div className="login-brand" aria-label="KINO Laundry">
            <WashingMachine size={24} strokeWidth={2} aria-hidden="true" />
            <span>KINO <b>Laundry</b></span>
          </div>
          <button
            className="login-theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            title={dark ? 'Mode gelap aktif' : 'Mode terang aktif'}
          >
            {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>

        <div className="login-intro">
          <h1 id="login-title">Masuk</h1>
          <p>Gunakan akun yang diberikan owner.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label className="login-field">
            <span>Email atau nama pengguna</span>
            <input
              autoFocus
              autoComplete="username"
              name="username"
              value={identity}
              onChange={event => setIdentity(event.target.value)}
              placeholder="Masukkan email atau nama pengguna"
              required
            />
          </label>

          <label className="login-field">
            <span>Kata sandi</span>
            <span className="login-password-control">
              <input
                autoComplete="current-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                onKeyDown={updateCapsLock}
                onKeyUp={updateCapsLock}
                onBlur={() => setCapsLock(false)}
                placeholder="Masukkan kata sandi"
                required
              />
              <button
                className="login-password-toggle"
                type="button"
                onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-pressed={showPassword}
              >
                {showPassword
                  ? <EyeOff size={20} aria-hidden="true" />
                  : <Eye size={20} aria-hidden="true" />}
              </button>
            </span>
            {capsLock && <span className="login-caps-warning" role="status">Caps Lock aktif</span>}
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-submit" type="submit" disabled={busy}>
            {busy && <span className="login-spinner" aria-hidden="true" />}
            {busy ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="login-help">Lupa kata sandi? Hubungi owner.</p>
      </section>
      <footer className="login-copyright">© 2026 KINO Laundry</footer>
    </main>
  )
}
