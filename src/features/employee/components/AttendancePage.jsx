import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CalendarCheck, Camera, Check, Clock3, Eye, LogOut, MapPin, RotateCcw, WashingMachine, X } from 'lucide-react'
import { api, logout } from '../../../shared/api'
import '../../../shared/styles/entry.css'
import './attendance-safeguards.css'

const reasons = ['Izin', 'Sakit', 'Diizinkan owner', 'Lainnya']
const uuid = () => window.crypto.randomUUID()
const formatTime = value => value ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—'
const formatDate = value => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(value)
const formatDuration = milliseconds => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours} jam ${minutes} menit` : `${minutes} menit`
}
const startHoldFromKeyboard = event => {
  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) startHold(event)
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat ini tidak menyediakan lokasi GPS.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      }),
      error => reject(new Error(error.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin lokasi untuk melakukan absensi.' : 'Lokasi tidak dapat diperoleh. Aktifkan GPS lalu coba lagi.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  })
}

export default function AttendancePage({ user, onLogout }) {
  const [record, setRecord] = useState(null)
  const [openAttendance, setOpenAttendance] = useState(null)
  const [currentShiftAttendance, setCurrentShiftAttendance] = useState(null)
  const [canCheckIn, setCanCheckIn] = useState(false)
  const [currentShift, setCurrentShift] = useState(null)
  const [recent, setRecent] = useState([])
  const [graceMinutes, setGraceMinutes] = useState(30)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [stage, setStage] = useState('')
  const [location, setLocation] = useState(null)
  const [earlyReason, setEarlyReason] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const [cameraError, setCameraError] = useState('')
  const [cameraStream, setCameraStream] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [undoBusy, setUndoBusy] = useState(false)
  const [undoMessage, setUndoMessage] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const holdIntervalRef = useRef(null)
  const holdStartedAtRef = useRef(0)
  const checkoutKeyRef = useRef('')
  const cancelKeyRef = useRef('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const result = await api('/api/attendance/me')
      setRecord(result.attendance || null)
      setOpenAttendance(result.open_attendance || null)
      setCurrentShiftAttendance(result.current_shift_attendance || null)
      setCurrentShift(result.current_shift || null)
      setCanCheckIn(Boolean(result.can_check_in))
      setRecent(result.recent || [])
      setGraceMinutes(Number(result.checkout_grace_minutes ?? 30))
    } catch (reason) {
      setError(reason.message)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!photo) {
      setPhotoUrl('')
      return undefined
    }
    const url = URL.createObjectURL(photo)
    setPhotoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  useEffect(() => {
    if (stage !== 'selfie') return undefined
    let active = true
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera selfie tidak tersedia. Buka halaman melalui HTTPS dan izinkan akses kamera.')
      return undefined
    }
    setCameraError('')
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } })
      .then(stream => {
        if (!active) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        cameraStreamRef.current = stream
        setCameraStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => setCameraError('Kamera belum siap. Periksa izin kamera lalu coba lagi.'))
        }
      })
      .catch(() => setCameraError('Kamera tidak dapat dibuka. Izinkan akses kamera untuk mengambil selfie pulang.'))
    return () => {
      active = false
      cameraStreamRef.current?.getTracks().forEach(track => track.stop())
      cameraStreamRef.current = null
      setCameraStream(null)
    }
  }, [stage])

  const activeAttendance = openAttendance || currentShiftAttendance
  const completedAttendance = !activeAttendance && record?.check_out_at ? record : activeAttendance?.check_out_at ? activeAttendance : null
  const checkInTime = activeAttendance?.check_in_at
  const availableAt = checkInTime ? new Date(new Date(checkInTime).getTime() + graceMinutes * 60000) : null
  const graceRemaining = availableAt ? Math.max(0, availableAt.getTime() - now) : 0
  const checkoutLocked = Boolean(activeAttendance && !activeAttendance.check_out_at && graceRemaining > 0)
  const undoUntil = record?.undo_until ? new Date(record.undo_until).getTime() : 0
  const undoRemaining = Math.max(0, undoUntil - now)
  const shiftEndAt = activeAttendance?.shift_end_at ? new Date(activeAttendance.shift_end_at) : null
  const isEarly = Boolean(shiftEndAt && now < shiftEndAt.getTime())

  const actCheckIn = async () => {
    if (busy) return
    setBusy(true); setError(''); setUndoMessage('')
    try {
      const coordinates = await currentPosition()
      const result = await api('/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ ...coordinates, idempotency_key: uuid() }),
      })
      setRecord(result.attendance)
      setOpenAttendance(result.attendance)
      setCurrentShiftAttendance(result.attendance)
      setCanCheckIn(false)
      setRecent(items => [result.attendance, ...items.filter(item => item.id !== result.attendance.id)])
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  const beginCheckout = async () => {
    if (busy || checkoutLocked || !activeAttendance) return
    setBusy(true); setError(''); setUndoMessage('')
    try {
      const coordinates = await currentPosition()
      setLocation(coordinates)
      checkoutKeyRef.current = uuid()
      setEarlyReason('')
      setStage(isEarly ? 'early' : 'confirm')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  const continueEarlyCheckout = () => {
    if (!earlyReason) return
    setStage('confirm')
  }

  const stopHold = () => {
    if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current)
    holdIntervalRef.current = null
    holdStartedAtRef.current = 0
    setHoldProgress(0)
  }
  const startHold = event => {
    event.preventDefault()
    if (holdIntervalRef.current || stage !== 'confirm') return
    holdStartedAtRef.current = performance.now()
    holdIntervalRef.current = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - holdStartedAtRef.current) / 1500)
      setHoldProgress(progress)
      if (progress >= 1) {
        stopHold()
        setPhoto(null)
        setCameraError('')
        setStage('selfie')
      }
    }, 25)
  }
  useEffect(() => () => {
    if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current)
  }, [])

  const captureSelfie = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setCameraError('Kamera belum siap mengambil foto. Coba lagi.')
      return
    }
    const width = Math.min(video.videoWidth, 1280)
    const height = Math.round(video.videoHeight * width / video.videoWidth)
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Pratinjau foto tidak dapat disiapkan pada perangkat ini.')
      return
    }
    context.drawImage(video, 0, 0, width, height)
    const stripHeight = Math.max(54, Math.round(height * 0.14))
    context.fillStyle = 'rgba(0,0,0,.62)'
    context.fillRect(0, height - stripHeight, width, stripHeight)
    context.fillStyle = '#fff'
    context.font = `600 ${Math.max(14, Math.round(width * 0.025))}px sans-serif`
    context.fillText(`KINO LAUNDRY · ${user.name}`, 16, height - stripHeight * 0.57)
    context.font = `${Math.max(12, Math.round(width * 0.019))}px sans-serif`
    context.fillText(`ABSEN PULANG · ${formatDate(new Date())} · ${formatTime(new Date())} WIB`, 16, height - 12)
    canvas.toBlob(blob => {
      if (!blob) {
        setCameraError('Foto tidak dapat diproses. Silakan ambil ulang.')
        return
      }
      setPhoto(blob)
      setStage('preview')
      setCameraError('')
    }, 'image/jpeg', 0.86)
  }

  const submitCheckout = async () => {
    if (!photo || !location || busy) return
    setBusy(true); setError('')
    try {
      const currentLocation = await currentPosition()
      setLocation(currentLocation)
      const form = new FormData()
      form.set('photo', photo, 'attendance-selfie.jpg')
      form.set('latitude', String(currentLocation.latitude))
      form.set('longitude', String(currentLocation.longitude))
      form.set('accuracy', String(currentLocation.accuracy))
      form.set('location_timestamp', String(currentLocation.timestamp))
      form.set('reason', earlyReason)
      form.set('idempotency_key', checkoutKeyRef.current)
      const result = await api('/api/attendance/check-out', { method: 'POST', body: form })
      setRecord({ ...result.attendance, undo_until: result.undo_until })
      setOpenAttendance(null)
      setCurrentShiftAttendance(result.attendance)
      setRecent(items => [result.attendance, ...items.filter(item => item.id !== result.attendance.id)])
      setCanCheckIn(false)
      setStage('')
      setPhoto(null)
      setLocation(null)
      setEarlyReason('')
      cancelKeyRef.current = uuid()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelCheckout = async () => {
    if (undoBusy) return
    setUndoBusy(true); setError('')
    try {
      const result = await api('/api/attendance/cancel-check-out', {
        method: 'POST',
        body: JSON.stringify({ idempotency_key: cancelKeyRef.current || uuid() }),
      })
      setOpenAttendance(result.attendance)
      setCurrentShiftAttendance(result.attendance)
      setRecord(result.attendance)
      setRecent(items => [result.attendance, ...items.filter(item => item.id !== result.attendance.id)])
      setCanCheckIn(false)
      setUndoMessage('Absen pulang dibatalkan. Status kembali menjadi sedang bekerja.')
      cancelKeyRef.current = uuid()
    } catch (reason) {
      setError(reason.message)
      if (reason.message.includes('2 menit')) await refresh()
    } finally {
      setUndoBusy(false)
    }
  }

  const closeFlow = () => {
    stopHold()
    setStage('')
    setPhoto(null)
    setCameraError('')
    setError('')
  }

  const date = formatDate(new Date())
  const remainingLabel = milliseconds => {
    const total = Math.ceil(milliseconds / 1000)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  }

  return <main className="owner-login-page attendance-page">
    <section className="owner-login-card attendance-card">
      <div className="attendance-head">
        <span className="attendance-mark"><WashingMachine/></span>
        <span><b>KINO LAUNDRY</b><small>ABSENSI KARYAWAN</small></span>
        <button onClick={async()=>{try{await logout()}finally{onLogout()}}}><LogOut size={16}/> Keluar</button>
      </div>
      <div className="attendance-body">
        <div className="owner-form-kicker">HALO, {user.name.toLocaleUpperCase('id-ID')}</div>
        <h1>Absensi hari ini</h1>
        <p><CalendarCheck size={16}/> {date}</p>
        {error && <div className="owner-login-notice" role="alert">{error}</div>}
        {undoMessage && <div className="attendance-undo-message" role="status"><Check size={16}/>{undoMessage}</div>}
        <section className="attendance-times">
          <div><small>MASUK · {activeAttendance?.shift_type || record?.shift_type || currentShift?.shift_type || 'SHIFT'}</small><b>{formatTime(activeAttendance?.check_in_at || record?.check_in_at)}</b></div>
          <div><small>PULANG</small><b>{formatTime(activeAttendance?.check_out_at || record?.check_out_at)}</b></div>
        </section>

        {!activeAttendance && canCheckIn && <div className="attendance-active-shift">
          <span>Shift {currentShift?.shift_type || ''} sedang berlangsung</span>
          <button disabled={busy} className="attendance-primary-button" onClick={actCheckIn}><Clock3 size={18}/>{busy ? 'Memvalidasi lokasi…' : 'Catat jam masuk'}</button>
        </div>}
        {!activeAttendance && !canCheckIn && <div className="attendance-no-shift">
          <Clock3 size={18}/><span>Tidak ada jadwal shift aktif saat ini. Absensi masuk tersedia pada jam shift yang ditetapkan.</span>
        </div>}
        {activeAttendance && !activeAttendance.check_out_at && <>
          {checkoutLocked
            ? <div className="attendance-locked-button" aria-disabled="true">
                <span>Pulang tersedia pukul {formatTime(availableAt)}</span>
                <small>Jeda pulang · {remainingLabel(graceRemaining)}</small>
              </div>
            : <button disabled={busy} className="attendance-checkout-button" onClick={beginCheckout}><Clock3 size={18}/>{busy ? 'Memeriksa lokasi…' : 'Catat jam pulang'}</button>}
          <small className="attendance-hint">Shift {activeAttendance.shift_type} · Berakhir pukul {formatTime(activeAttendance.shift_end_at)}</small>
        </>}
        {completedAttendance && <section className="attendance-done">
          <b>Absen pulang tercatat pukul {formatTime(completedAttendance.check_out_at)}</b>
          {completedAttendance.checkout_reason && <span>Alasan: {completedAttendance.checkout_reason}</span>}
          {undoRemaining > 0
            ? <div className="attendance-undo-card">
                <span>Salah tekan? Batalkan · {remainingLabel(undoRemaining)}</span>
                <button disabled={undoBusy} onClick={cancelCheckout}><RotateCcw size={15}/>{undoBusy ? 'Membatalkan…' : 'Batalkan'}</button>
              </div>
            : <span className="attendance-undo-expired">Jendela pembatalan telah berakhir. Hubungi Owner jika perlu koreksi.</span>}
        </section>}
        {recent.length > 1 && <div className="attendance-recent">
          <b>Absensi shift lainnya</b>
          {recent.filter(item => item.id !== activeAttendance?.id && item.id !== record?.id).map(item =>
            <span key={item.id}>Shift {item.shift_type} · Masuk {formatTime(item.check_in_at)} · Pulang {formatTime(item.check_out_at)}</span>
          )}
        </div>}
        <small className="attendance-hint">Lokasi GPS diverifikasi dalam radius 100 meter dari outlet. Selfie pulang disimpan privat selama 30 hari.</small>
      </div>
    </section>

    {stage && <div className="attendance-sheet-backdrop" onMouseDown={event => event.target === event.currentTarget && closeFlow()}>
      <section className="attendance-bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="attendance-sheet-title">
        <button type="button" className="attendance-sheet-close" aria-label="Tutup" onClick={closeFlow}><X size={18}/></button>
        {stage === 'early' && <>
          <div className="attendance-sheet-icon warning"><AlertTriangle size={20}/></div>
          <h2 id="attendance-sheet-title">Shift Anda belum selesai</h2>
          <p>Shift berakhir pukul {formatTime(shiftEndAt)}. Pulang lebih awal?</p>
          <div className="attendance-reason-chips" role="group" aria-label="Pilih alasan pulang lebih awal">
            {reasons.map(reason => <button type="button" key={reason} className={earlyReason === reason ? 'selected' : ''} onClick={() => setEarlyReason(reason)}>{reason}</button>)}
          </div>
          <div className="attendance-sheet-actions">
            <button type="button" className="attendance-secondary-button" onClick={closeFlow}>Batal</button>
            <button type="button" className="attendance-primary-button" disabled={!earlyReason} onClick={continueEarlyCheckout}>Lanjut</button>
          </div>
        </>}
        {stage === 'confirm' && <>
          <div className="attendance-sheet-icon"><MapPin size={20}/></div>
          <h2 id="attendance-sheet-title">Konfirmasi absen pulang</h2>
          <p className="attendance-checkout-question">Catat pulang pukul {formatTime(new Date(now))}?</p>
          <div className="attendance-confirm-summary">
            <span><Clock3 size={16}/><span>Anda bekerja {formatDuration(now - new Date(activeAttendance?.check_in_at).getTime())}</span></span>
            <span><MapPin size={16}/><span>Lokasi terverifikasi · di dalam area outlet</span></span>
            {earlyReason && <span><AlertTriangle size={16}/><span>Pulang lebih awal · {earlyReason}</span></span>}
          </div>
          <div className="attendance-hold-actions">
            <button type="button" className="attendance-secondary-button" onPointerUp={stopHold} onClick={closeFlow}>Batal</button>
            <button type="button" className="attendance-hold-button" style={{ '--hold-progress': `${holdProgress * 100}%` }} onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onKeyDown={startHoldFromKeyboard} onKeyUp={stopHold} onBlur={stopHold} aria-label="Tahan satu setengah detik untuk mengambil selfie">
              <span>{holdProgress > 0 ? `Tahan… ${Math.ceil((1.5 - holdProgress * 1.5) * 10) / 10} dtk` : 'Tahan 1,5 detik'}</span>
            </button>
          </div>
          <small className="attendance-hold-hint">Selfie dibuka setelah konfirmasi tahan berhasil.</small>
        </>}
        {stage === 'selfie' && <>
          <div className="attendance-sheet-icon"><Camera size={20}/></div>
          <h2 id="attendance-sheet-title">Ambil selfie pulang</h2>
          <p>Pastikan wajah terlihat jelas. Nama karyawan dan waktu ditambahkan sebagai watermark.</p>
          {cameraError && <div className="owner-login-notice" role="alert">{cameraError}</div>}
          <video ref={videoRef} className="attendance-camera-video" playsInline muted aria-label="Pratinjau kamera selfie"/>
          <canvas ref={canvasRef} className="attendance-hidden-canvas"/>
          <div className="attendance-sheet-actions">
            <button type="button" className="attendance-secondary-button" onClick={() => setStage('confirm')}>Kembali</button>
            <button type="button" className="attendance-primary-button" disabled={!cameraStream || Boolean(cameraError)} onClick={captureSelfie}><Camera size={16}/> Ambil foto</button>
          </div>
        </>}
        {stage === 'preview' && <>
          <div className="attendance-sheet-icon"><Eye size={20}/></div>
          <h2 id="attendance-sheet-title">Pratinjau selfie</h2>
          <p>Periksa foto dan watermark sebelum menyimpan absensi.</p>
          {photoUrl && <img className="attendance-photo-preview" src={photoUrl} alt="Pratinjau selfie pulang dengan watermark"/>}
          <div className="attendance-sheet-actions">
            <button type="button" className="attendance-secondary-button" disabled={busy} onClick={() => { setPhoto(null); setStage('selfie') }}><RotateCcw size={15}/> Ambil ulang</button>
            <button type="button" className="attendance-primary-button" disabled={busy} onClick={submitCheckout}><Check size={16}/>{busy ? 'Menyimpan…' : 'Simpan absen pulang'}</button>
          </div>
        </>}
      </section>
    </div>}
  </main>
}
