import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowRight, Bell, Check, ChevronDown, CircleHelp, Clock3, Coins, CreditCard, LayoutDashboard, LogOut, Menu, Moon, Package, Plus, Printer, Search, Settings2, Share2, Shirt, ShoppingBag, ShoppingCart, Sparkles, Sun, Trash2, UserRound, Wallet, WashingMachine, X, ReceiptText } from 'lucide-react'
import { categories, navGroups, services } from './data/catalog'
import OrderManagement from './components/OrderManagement'
import CashierDashboard from './components/CashierDashboard'
import TransactionHistory from './components/TransactionHistory'
import InventoryManagement from './components/InventoryManagement'
import CoinManagement from './components/CoinManagement'
import SettingsPage from './components/SettingsPage'
import HelpPage from './components/HelpPage'
import ShiftReports from './components/ShiftReports'
import MembershipPicker from './components/MembershipPicker'
import ExpensePage from '../../shared/ExpenseManagement'
import { api } from '../../shared/api'
import './styles/checkout.css'
import './styles/membership.css'

const icons = { Dashboard: LayoutDashboard, 'Transaksi Baru': ShoppingCart, 'Pesanan Laundry': Shirt, 'Riwayat Transaksi': Clock3, 'Produk & Stok': Package, 'Manajemen Koin': Coins, Laporan: Activity, Pengeluaran: ReceiptText, Bantuan: CircleHelp }
const money = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
const Icon = ({ icon: I, size = 18, ...props }) => <I size={size} strokeWidth={1.8} {...props} />

export default function App({ user, onLogout }) {
  const [dark, setDark] = useState(() => window.localStorage.getItem('kino-theme') === 'dark')
  const [category, setCategory] = useState('Self Service')
  const [active, setActive] = useState('Transaksi Baru')
  const [cart, setCart] = useState([])
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState(false)
  const [method, setMethod] = useState('Tunai')
  const [cash, setCash] = useState('')
  const [checkoutDetails, setCheckoutDetails] = useState({ customerName: '', customerPhone: '', weightKg: '', notes: '', deliveryFee: '0', discountAmount: '0' })
  const [selectedMember, setSelectedMember] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [success, setSuccess] = useState(null)
  const requestRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [toast, setToast] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [serverServices, setServerServices] = useState([])
  const [serverProducts, setServerProducts] = useState([])
  const [catalogError, setCatalogError] = useState('')
  const [shift, setShift] = useState(undefined)
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
  const [shiftType, setShiftType] = useState('pagi')
  const [closingShift, setClosingShift] = useState(false)
  const [shiftCloseConfirm, setShiftCloseConfirm] = useState(null)
  const [closedShift, setClosedShift] = useState(null)
  const [serverError, setServerError] = useState('')
  useEffect(() => {
    Promise.allSettled([api('/api/services'), api('/api/products')]).then(results => {
      const failures = []
      if (results[0].status === 'fulfilled') setServerServices(results[0].value.items)
      else failures.push(results[0].reason.message)
      if (results[1].status === 'fulfilled') setServerProducts(results[1].value.items)
      else failures.push(results[1].reason.message)
      setCatalogError(failures.join(' '))
    })
    api('/api/cashier/dashboard').then(r=>setShift(r.shift)).catch(e=>setServerError(e.message))
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { window.localStorage.setItem('kino-theme', dark ? 'dark' : 'light') }, [dark])
  const today = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(now)
  const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(now)
  const isSelfServiceItem = item => item.serviceCategory === 'Self Service'
  const selfServiceMachineCount = item => {
    const weight = Number(item.weightKg)
    const roundedWeight = Math.round(weight * 100) / 100
    return Number.isFinite(weight) && roundedWeight > 0 ? Math.ceil(roundedWeight / 7) : 0
  }
  const lineQuantity = (item) => {
    if (isSelfServiceItem(item)) return selfServiceMachineCount(item) * item.qty
    if (item.unit === 'kg') return Number(checkoutDetails.weightKg || 0) * item.qty
    if (item.unit === '7kg') return Math.ceil(Number(checkoutDetails.weightKg || 0) / 7)
    return item.qty
  }
  const coinEstimate = cart.reduce((needs, item) => {
    if (!isSelfServiceItem(item)) return needs
    const machines = selfServiceMachineCount(item) * item.qty
    if (item.serviceCode === 'SELF-CUCI' || item.serviceCode === 'SELF-KERING') needs.regular += machines
    if (item.serviceCode === 'SELF-CUCI-KERING') needs.regular += machines * 2
    if (item.serviceCode === 'SELF-EXTRA-DRY') needs.extraDry += machines
    return needs
  }, { regular: 0, extraDry: 0 })
  const subtotal = useMemo(() => cart.reduce((sum, item) => {
    const quantity = lineQuantity(item)
    return sum + item.price * quantity
  }, 0), [cart, checkoutDetails.weightKg])
  const deliveryFee = Number(checkoutDetails.deliveryFee || 0)
  const discountAmount = Number(checkoutDetails.discountAmount || 0)
  const total = Math.max(0, subtotal + (Number.isFinite(deliveryFee) ? deliveryFee : 0) - (Number.isFinite(discountAmount) ? discountAmount : 0))
  const selfServiceWeightsValid = cart.filter(isSelfServiceItem).every(item => {
    const weight = Number(item.weightKg)
    return Number.isFinite(weight) && weight > 0 && weight <= 9999.99
  })
  const needsTransactionWeight = cart.some(item => item.serviceId && !isSelfServiceItem(item))
  const transactionWeightValid = !needsTransactionWeight || (
    Number.isFinite(Number(checkoutDetails.weightKg)) &&
    Number(checkoutDetails.weightKg) > 0 &&
    Number(checkoutDetails.weightKg) <= 9999.99
  )
  const checkoutWeightsValid = selfServiceWeightsValid && transactionWeightValid
  const totalWeightKg = cart.some(isSelfServiceItem)
    ? selfServiceWeightsValid ? cart.filter(isSelfServiceItem).reduce((sum, item) => sum + Number(item.weightKg), 0) : null
    : needsTransactionWeight && transactionWeightValid ? Number(checkoutDetails.weightKg) : null
  const formatWeight = weight => `${Number(weight).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`
  const jakartaHour = Number(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(now))
  const nightPricing = jakartaHour >= 23 || jakartaHour < 6
  const categoryServices = category === 'Produk & Minuman'
    ? serverProducts.map(row => {
      const display = services[category].find(item => item.name.toLowerCase() === row.name.toLowerCase())
      return { ...(display || {}), name: row.name, note: `${Number(row.stock)} ${row.unit} tersedia`, productId: row.id, id: `product:${row.id}`, price: Number(row.price), unit: row.unit, stock: Number(row.stock), unavailable: Number(row.stock) <= 0 }
    })
    : serverServices.filter(row => row.category.toLowerCase() === category.toLowerCase()).map(row => {
      const display = (services[category] || []).find(item => item.name.toLowerCase() === row.name.toLowerCase())
      return { ...(display || {}), name: row.name, serviceId: row.id, serviceCode: row.code, serviceCategory: row.category, id: `service:${row.id}`, price: Number(row.unit_price), unit: row.pricing_unit, unavailable: false }
    })
  const filteredServices = categoryServices.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
  const addItem = (service) => {
    if (service.serviceId) {
      const currentServices = cart.filter(item => item.serviceId)
      const categories = new Set([...currentServices.map(item => item.serviceCategory), service.serviceCategory])
      const hasDropOffCategory = categories.has('Drop Off') || categories.has('Setrika Saja')
      if (categories.has('Self Service') && categories.size > 1) {
        notify('Self Service tidak dapat dicampur dengan Drop Off atau layanan lain.')
        return
      }
      if (categories.size > 1 && !(categories.size === 2 && categories.has('Drop Off') && categories.has('Setrika Saja'))) {
        notify('Pisahkan jenis layanan utama yang berbeda ke transaksi terpisah.')
        return
      }
      if (hasDropOffCategory) {
        const codes = [...new Set([...currentServices.map(item => item.serviceCode), service.serviceCode])].sort()
        const allowed = [
          ['DROP-CUCI-KERING'], ['DROP-KERING'], ['DROP-LIPAT'], ['SET-REG'], ['SET-EXP'],
          ['DROP-KERING', 'DROP-LIPAT'], ['DROP-KERING', 'SET-REG'], ['DROP-KERING', 'SET-EXP'],
        ].some(values => values.sort().join('|') === codes.join('|'))
        if (!allowed) {
          notify('Kombinasi Drop Off tidak valid. Kering + Lipat dan Kering + Setrika dapat dipilih bersama.')
          return
        }
      }
    }
    if (service.serviceCategory === 'Self Service') {
      setCart(current => [...current, { ...service, cartKey: crypto.randomUUID(), qty: 1, weightKg: '' }])
    } else {
      setCart(current => {
        const found = current.find(i => i.id === service.id)
        if (service.unit === '7kg' && found) return current
        return found
          ? current.map(i => i.id === service.id ? { ...i, qty: i.qty + 1 } : i)
          : [...current, { ...service, cartKey: service.id, qty: 1 }]
      })
    }
    notify(`${service.name} ditambahkan`)
  }
  const changeQty = (cartKey, delta) => setCart(current => current.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0))
  const changeLineWeight = (cartKey, weightKg) => setCart(current => current.map(i => i.cartKey === cartKey ? { ...i, weightKg } : i))
  const removeLine = cartKey => setCart(current => current.filter(i => i.cartKey !== cartKey))
  const selectNav = (name) => { setActive(name); setMobileMenu(false) }
  const paid = async (paymentMethod = method === 'QRIS' ? 'qris' : 'tunai', confirmQris = false) => {
    if (confirmQris && !window.confirm('Pastikan speaker pembayaran berbunyi dan dana QRIS telah masuk sebelum mengonfirmasi pembayaran.')) return
    const payload = {
      payment_method: paymentMethod,
      cash_received: paymentMethod === 'tunai' ? Number(cash || 0) : 0,
      customer_name: checkoutDetails.customerName.trim(),
      customer_phone: checkoutDetails.customerPhone.trim(),
      membership_member_id: selectedMember?.id || null,
      weight_kg: checkoutDetails.weightKg === '' ? null : Number(checkoutDetails.weightKg),
      notes: checkoutDetails.notes.trim(),
      delivery_fee: deliveryFee,
      discount_amount: discountAmount,
      items: cart.map(item => ({
        service_id: item.serviceId,
        product_id: item.productId,
        quantity: item.qty,
        ...(isSelfServiceItem(item) ? { weight_kg: Number(item.weightKg) } : {}),
      })),
    }
    const fingerprint = JSON.stringify(payload)
    if (requestRef.current?.fingerprint !== fingerprint) {
      requestRef.current = { fingerprint, key: crypto.randomUUID() }
    }
    setSubmitting(true)
    setCheckoutError('')
    try {
      const result = await api('/api/transactions', {
        method: 'POST',
        headers: { 'Idempotency-Key': requestRef.current.key },
        body: JSON.stringify(payload),
      })
      let transaction = result.transaction
      if (confirmQris) {
        await api(`/api/transactions/${transaction.id}/confirm-payment`, {
          method: 'POST',
          body: JSON.stringify({ payment_method: 'qris' }),
        })
        transaction = { ...transaction, payment_method: 'qris', payment_status: 'lunas' }
      }
      const receiptItems = cart.map(item => {
        const quantity = lineQuantity(item)
        const machines = selfServiceMachineCount(item)
        const machineText = item.serviceCode === 'SELF-CUCI'
          ? `${machines} washer`
          : item.serviceCode === 'SELF-KERING'
            ? `${machines} dryer`
            : item.serviceCode === 'SELF-CUCI-KERING'
              ? `${machines} washer + ${machines} dryer`
              : `${machines} mesin`
        return {
          name: item.name,
          quantity,
          unit: item.unit,
          weightKg: isSelfServiceItem(item) ? Number(item.weightKg) : null,
          detail: isSelfServiceItem(item) ? `${formatWeight(item.weightKg)} · ${machineText}` : `${quantity} ${item.unit}`,
          subtotal: item.price * quantity,
        }
      })
      const receiptWeight = cart.some(isSelfServiceItem)
        ? cart.filter(isSelfServiceItem).reduce((sum, item) => sum + Number(item.weightKg), 0)
        : needsTransactionWeight ? Number(checkoutDetails.weightKg) : null
      setPayment(false)
      setCart([])
      setCash('')
      setCheckoutDetails({ customerName: '', customerPhone: '', weightKg: '', notes: '', deliveryFee: '0', discountAmount: '0' })
      requestRef.current = null
      setSuccess({
        number: transaction.transaction_number,
        paymentStatus: transaction.payment_status,
        membershipStamp: result.membership_stamp,
        receipt: {
          createdAt: transaction.created_at,
          cashierName: user?.name || 'Kasir',
          customerName: selectedMember?.name || checkoutDetails.customerName.trim() || 'Pelanggan umum',
          customerPhone: selectedMember?.phone || checkoutDetails.customerPhone.trim(),
          memberNumber: selectedMember?.member_number || '',
          items: receiptItems,
          totalWeightKg: receiptWeight,
          subtotal,
          deliveryFee,
          discountAmount,
          total: Number(transaction.total),
          paymentMethod: transaction.payment_method,
          paymentStatus: transaction.payment_status,
          cashReceived: paymentMethod === 'tunai' ? Number(cash || 0) : 0,
          change: Number(result.change || 0),
        },
      })
      setSelectedMember(null)
    } catch (error) {
      setCheckoutError(error.message)
    } finally {
      setSubmitting(false)
    }
  }
  const openShift=async()=>{try{const r=await api('/api/shifts/open',{method:'POST',body:JSON.stringify({shift_type:shiftType})});setShift(r.shift);setClosedShift(null);setServerError('')}catch(e){setServerError(e.message)}}
  const requestShiftClose = shiftToClose => {
    if (!shiftToClose?.id) {
      setServerError('Data sesi shift belum tersedia. Muat ulang dashboard sebelum menutup shift.')
      return
    }
    setServerError('')
    setShiftCloseConfirm(shiftToClose)
  }
  const closeShift=async()=>{
    if(!shiftCloseConfirm || closingShift)return
    setClosingShift(true);setServerError('')
    try{
      const result=await api('/api/shifts/close',{method:'POST',body:JSON.stringify({shift_id:Number(shiftCloseConfirm.id)})})
      setShiftCloseConfirm(null);setClosedShift(result);setShift(null)
    }
    catch(e){setServerError(e.message)}
    finally{setClosingShift(false)}
  }
  if(shift===undefined)return <div className="auth-loading">Menghubungkan ke data kasir…</div>
  if(!shift && closedShift)return <ShiftCloseSummary result={closedShift} cashierName={user?.name} dark={dark} onContinue={()=>setClosedShift(null)}/>
  if(!shift)return <main className="owner-login-page"><section className="owner-login-card attendance-card"><div className="attendance-body"><div className="owner-form-kicker">KINO LAUNDRY · KASIR</div><h1>Mulai shift kerja</h1><p>Pilih shift agar transaksi tercatat dengan benar.</p>{serverError&&<div className="owner-login-notice">{serverError}</div>}<select className="shift-select" value={shiftType} onChange={e=>setShiftType(e.target.value)}><option value="pagi">Shift pagi</option><option value="siang">Shift siang</option><option value="sore">Shift sore</option><option value="malam">Shift malam</option></select><button className="owner-signin-button attendance-action" onClick={openShift}>Buka shift</button><button className="shift-logout" onClick={onLogout}>Keluar</button></div></section></main>

  return <div className={`app-shell ${dark ? 'dark' : ''}`}>
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><WashingMachine size={21} strokeWidth={2.2}/></div><div><b>KINO<span>.</span></b><small>LAUNDRY POS</small></div><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Tutup menu"><X size={19}/></button></div>
      <button className="branch-switch"><div className="branch-avatar">K</div><span><b>KINO Laundry</b><small>Cabang Cempaka</small></span><ChevronDown size={15}/></button>
      <div className="nav-groups">{navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => <button key={item.name} className={`nav-item ${active === item.name ? 'active' : ''}`} onClick={() => selectNav(item.name)}><Icon icon={icons[item.name] || LayoutDashboard} size={18}/><span>{item.name}</span>{item.count && <span className="nav-count">{item.count}</span>}</button>)}</div>)}
        <div className="nav-group"><div className="nav-label">Pengaturan</div><button className={`nav-item ${active === 'Pengaturan' ? 'active' : ''}`} onClick={() => selectNav('Pengaturan')}><Settings2 size={18}/><span>Pengaturan</span></button><button className={`nav-item ${active === 'Bantuan' ? 'active' : ''}`} onClick={() => selectNav('Bantuan')}><CircleHelp size={18}/><span>Pusat Bantuan</span></button></div>
      </div>
      <div className="sidebar-bottom"><div className="shift-card"><div className="shift-icon"><Clock3 size={17}/></div><div className="shift-copy"><small>SESI KASIR</small><b>{user?.name || 'Kasir'}</b></div><span className="live-dot"/></div><div className="profile-row"><div className="profile-avatar">{(user?.name||'K').slice(0,2).toUpperCase()}</div><div className="profile-meta"><b>{user?.name||'Kasir'}</b><small>Kasir</small></div></div><button className="sidebar-logout" onClick={onLogout} aria-label="Keluar dari akun" title="Keluar dari akun"><LogOut size={17}/><span>Keluar</span></button></div>
    </aside>
    {mobileMenu && <button className="scrim nav-scrim" onClick={() => setMobileMenu(false)} aria-label="Tutup menu"/>}

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Buka menu"><Menu size={20}/></button><div className="cashier-brand-copy"><b>KINO Laundry POS</b><span><i className="live-dot"/> Shift {shift?.shift_type || 'aktif'} · Kasir</span></div></div><div className="top-actions"><div className="today-chip"><span className="today-dot"/><span>{today}</span><b>{time} WIB</b></div><button className={`icon-button theme-toggle ${dark ? 'is-dark' : ''}`} onClick={() => setDark(!dark)} aria-label={dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}>{dark ? <Sun size={19}/> : <Moon size={18}/>}</button><button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={18}/><span/></button><div className="top-profile"><div className="profile-avatar">{(user?.name || 'K').slice(0, 2).toUpperCase()}</div><span><b>{user?.name || 'Kasir'}</b><small>{shift?.shift_type ? `Shift ${shift.shift_type}` : 'Shift aktif'} · Kasir</small></span><ChevronDown size={14}/></div>{!['Transaksi Baru', 'Dashboard'].includes(active) && <button className="btn btn-primary cashier-header-transaction" onClick={() => selectNav('Transaksi Baru')}><Plus size={16}/> Transaksi Baru</button>}</div></header>
      <div className={`workspace ${['Pesanan Laundry', 'Riwayat Transaksi', 'Produk & Stok', 'Manajemen Koin', 'Laporan', 'Pengeluaran', 'Pengaturan', 'Bantuan', 'Dashboard'].includes(active) ? 'workspace-full' : ''}`}>
        <section className="content-column">
          {active === 'Pesanan Laundry' ? <OrderManagement notify={notify}/> : active === 'Riwayat Transaksi' ? <TransactionHistory notify={notify}/> : active === 'Produk & Stok' ? <InventoryManagement notify={notify}/> : active === 'Manajemen Koin' ? <CoinManagement notify={notify}/> : active === 'Laporan' ? <ShiftReports notify={notify}/> : active === 'Pengeluaran' ? <ExpensePage notify={notify}/> : active === 'Pengaturan' ? <SettingsPage dark={dark} onTheme={setDark} notify={notify}/> : active === 'Bantuan' ? <HelpPage/> : active === 'Dashboard' ? <CashierDashboard onNavigate={selectNav} onCloseShift={requestShiftClose} closing={closingShift} /> : <>
          <section className="pos-card">
            <div className="pos-header"><div><div className="section-overline">LAYANAN & PRODUK</div><h3>Mulai transaksi</h3><p>Pilih layanan untuk ditambahkan ke keranjang.</p></div><div className={`pricing-badge ${nightPricing ? 'night-pricing' : ''}`}><span className="price-sun">☼</span> Harga {nightPricing ? 'malam aktif' : 'normal'} <ChevronDown size={13}/></div></div>
            <div className="category-tabs">{categories.map((c, i) => <button className={`category-tab ${category === c ? 'selected' : ''}`} onClick={() => { setCategory(c); setQuery('') }} key={c}>{i === 0 ? <WashingMachine size={15}/> : i === 1 ? <Shirt size={15}/> : i === 4 ? <ShoppingBag size={15}/> : <Sparkles size={15}/>}<span>{c}</span></button>)}</div>
            {category === 'Self Service' && <div className="machine-note"><div className="note-bubble"><WashingMachine size={15}/></div><span><b>Mesin tersedia</b><small>5 mesin cuci <i/> 7 mesin pengering</small></span><div className="capacity-note">Kapasitas maks. <b>7 kg</b></div></div>}
            {category === 'Drop Off' && <div className="machine-note"><div className="note-bubble"><UserRound size={15}/></div><span><b>Detail pesanan</b><small>Nama, berat, catatan, ongkir, dan diskon diisi sebelum transaksi disimpan.</small></span></div>}
            <div className="service-toolbar"><div className="service-caption"><b>{category}</b><span>{filteredServices.length} pilihan aktif</span></div><label className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari layanan..." /></label></div>
            {catalogError && <div className="checkout-error" role="alert">Katalog belum dapat dimuat: {catalogError}</div>}
            <div className="service-grid">{filteredServices.map(s => <button className="service-card" key={s.id} disabled={s.unavailable} onClick={() => addItem(s)}><div className={`service-icon ${s.color || 'blue'}`}><Icon icon={s.icon || Package} size={20}/>{!s.unavailable && <span className="service-add"><Plus size={13}/></span>}</div><b className="service-name">{s.name}</b><span className="service-note">{s.note || `Layanan per ${s.unit}`}</span><div className="service-price">{s.unavailable ? 'Stok habis' : money(s.price)}{!s.unavailable && <small>/{s.unit}</small>}</div></button>)}{!filteredServices.length && <div className="empty-search">{catalogError ? 'Katalog tidak tersedia.' : 'Tidak ada layanan aktif pada kategori ini.'}</div>}</div>
            {category === 'Self Service' && <div className="coin-note"><div className="coin-stack"><Coins size={17}/></div><span><b>Sistem koin praktis</b><small>1 koin reguler per mesin; Cuci + Kering memakai 2 koin reguler per pasangan mesin. Extra Dry memakai 1 koin khusus per pengering.</small>{cart.some(isSelfServiceItem) && <small>Estimasi keranjang: {coinEstimate.regular} koin reguler + {coinEstimate.extraDry} koin Extra Dry.</small>}</span><button onClick={() => selectNav('Manajemen Koin')}>Info koin <ArrowRight size={13}/></button></div>}
          </section>
          </>}
        </section>

        {!['Pesanan Laundry', 'Riwayat Transaksi', 'Produk & Stok', 'Manajemen Koin', 'Laporan', 'Pengeluaran', 'Pengaturan', 'Bantuan', 'Dashboard'].includes(active) && <aside className={`cart-panel ${cartOpen ? 'cart-open' : ''}`}><div className="cart-header"><div><div className="cart-title"><h3>Keranjang</h3><span className="cart-count">{cart.reduce((n, i) => n + i.qty, 0)}</span></div><p>Transaksi baru · Nomor dibuat saat tersimpan</p></div><button className="icon-button cart-close" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang"><X size={18}/></button><button className="clear-button" onClick={() => setCart([])} disabled={!cart.length}><Trash2 size={14}/> Kosongkan</button></div>
          <div className="cart-customer"><div className="customer-icon"><UserRound size={16}/></div><div><b>{checkoutDetails.customerName || 'Pelanggan umum'}</b><small>{checkoutDetails.customerPhone || 'Data pelanggan diisi saat checkout'}</small></div><button className="edit-customer" onClick={() => { setCheckoutError(''); setPayment(true) }}>Ubah</button></div>
          <div className="cart-items">{cart.length === 0 ? <div className="cart-empty"><div className="empty-illustration"><ShoppingCart size={27}/><span><Plus size={12}/></span></div><b>Keranjang masih kosong</b><p>Pilih layanan atau produk untuk memulai transaksi.</p></div> : cart.map(item => { const quantity = lineQuantity(item); const machineLabel = item.serviceCode === 'SELF-CUCI' ? `${quantity} washer` : item.serviceCode === 'SELF-KERING' ? `${quantity} dryer` : item.serviceCode === 'SELF-CUCI-KERING' ? `${quantity} washer + ${quantity} dryer` : `${quantity} mesin`; return <div className="cart-line" key={item.cartKey}><div className={`line-icon ${item.color}`}><Icon icon={item.icon} size={17}/></div><div className="line-details"><b>{item.name}</b><small>{money(item.price)} / {item.unit}</small>{isSelfServiceItem(item) ? <><small>{item.weightKg ? `${formatWeight(item.weightKg)} · ${machineLabel}` : 'Berat dan mesin diisi pada Detail & pembayaran'}</small></> : item.unit === '7kg' ? <small>{quantity} × tarif per 7 kg</small> : <div className="qty-control"><button onClick={() => changeQty(item.cartKey, -1)} aria-label={`Kurangi ${item.name}`}>−</button><span>{item.unit === 'kg' ? `${quantity} kg` : quantity}</span><button onClick={() => changeQty(item.cartKey, 1)} aria-label={`Tambah ${item.name}`}>+</button></div>}</div><b className="line-total">{money(item.price * quantity)}</b><button type="button" className="cart-line-remove" onClick={() => removeLine(item.cartKey)} aria-label={`Hapus ${item.name} dari keranjang`}><X size={15}/></button></div> })}</div>
          {cart.length > 0 && <div className="cart-extras"><button onClick={() => setPayment(true)}><Plus size={14}/> Catatan & pelanggan</button><button onClick={() => setPayment(true)}><Plus size={14}/> Ongkir & diskon</button></div>}
          <div className="cart-footer"><div className="subtotal-row"><span>Subtotal</span><b>{money(subtotal)}</b></div>{deliveryFee > 0 && <div className="subtotal-row"><span>Ongkir</span><b>{money(deliveryFee)}</b></div>}<div className="subtotal-row muted-row"><span>Diskon</span><button onClick={() => setPayment(true)}>{discountAmount > 0 ? `− ${money(discountAmount)}` : '+ Tambahkan'}</button></div><div className="total-row"><span>Total tagihan</span><b>{money(total)}</b></div><button className="btn btn-secondary save-order" disabled={!cart.length} onClick={() => { setCheckoutError(''); setPayment(true) }}><ShoppingBag size={17}/> Simpan belum dibayar</button><button className="btn btn-primary pay-button" disabled={!cart.length} onClick={() => { setCheckoutError(''); setPayment(true) }}>Bayar sekarang <ArrowRight size={17}/></button><div className="secure-note"><Check size={13}/> Data transaksi tersimpan setelah konfirmasi.</div></div>
        </aside>}
      </div>
      <footer className="status-footer"><span><span className="live-dot"/> Semua sistem berjalan normal</span><span>Versi 1.0.0 <i/> KINO Laundry POS</span></footer>
    </main>

    <nav className="mobile-nav"><button className={active === 'Dashboard' ? 'current' : ''} onClick={() => selectNav('Dashboard')}><LayoutDashboard size={19}/><span>Beranda</span></button><button className={active === 'Transaksi Baru' ? 'current' : ''} onClick={() => selectNav('Transaksi Baru')}><ShoppingCart size={19}/><span>Transaksi</span></button><button className={active === 'Pesanan Laundry' ? 'current' : ''} onClick={() => selectNav('Pesanan Laundry')}><Shirt size={19}/><span>Pesanan</span></button><button onClick={() => selectNav('Riwayat Transaksi')}><Clock3 size={19}/><span>Riwayat</span></button><button onClick={() => setCartOpen(true)}><ShoppingBag size={19}/><span>Keranjang</span>{cart.length > 0 && <i>{cart.length}</i>}</button></nav>
    {!['Pesanan Laundry', 'Riwayat Transaksi', 'Produk & Stok', 'Manajemen Koin', 'Laporan', 'Pengeluaran', 'Pengaturan', 'Bantuan', 'Dashboard'].includes(active) && <button className="mobile-cart-fab" onClick={() => setCartOpen(true)}><ShoppingCart size={19}/><span>Lihat keranjang</span><b>{money(total)}</b><span className="fab-count">{cart.reduce((n, i) => n + i.qty, 0)}</span></button>}
    {cartOpen && <button className="scrim cart-scrim" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang"/>}
    {toast && <div className="toast"><span className="toast-check"><Check size={14}/></span>{toast}</div>}
    {payment && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && !submitting && setPayment(false)}><section className="payment-modal" aria-labelledby="checkout-title"><div className="modal-header"><div><div className="section-overline">KONFIRMASI TRANSAKSI</div><h2 id="checkout-title">Detail & pembayaran</h2><p>Periksa rincian. Harga dan total akan divalidasi kembali oleh server.</p></div><button className="icon-button" onClick={() => setPayment(false)} disabled={submitting} aria-label="Tutup"><X size={19}/></button></div><div className="payment-total"><small>Total tagihan</small><b>{money(total)}</b>{totalWeightKg !== null && <span className="payment-total-weight">Total berat <strong>{formatWeight(totalWeightKg)}</strong></span>}<span>Nomor transaksi dibuat setelah tersimpan</span></div>
      <div className="checkout-landscape-grid">
      <div className="checkout-info-column"><MembershipPicker selectedMember={selectedMember} onSelect={setSelectedMember} notify={notify}/><div className="checkout-details">
        {!selectedMember && <>
        <label>Nama pelanggan (opsional)<input maxLength="100" value={checkoutDetails.customerName} onChange={e => setCheckoutDetails({ ...checkoutDetails, customerName: e.target.value })} placeholder="Nama pelanggan"/></label>
        <label>Nomor telepon (opsional)<input maxLength="30" value={checkoutDetails.customerPhone} onChange={e => setCheckoutDetails({ ...checkoutDetails, customerPhone: e.target.value })} placeholder="08xx xxxx xxxx"/></label>
        </>}
        {cart.some(item => item.serviceId && !isSelfServiceItem(item)) && <label>Berat laundry (kg)<input type="number" min="0.01" max="9999.99" step="0.01" required value={checkoutDetails.weightKg} onChange={e => setCheckoutDetails({ ...checkoutDetails, weightKg: e.target.value })} placeholder="Masukkan berat aktual"/></label>}
        {cart.filter(isSelfServiceItem).map(item => {
          const machines = selfServiceMachineCount(item)
          const machineLabel = item.serviceCode === 'SELF-CUCI' ? `${machines} washer` : item.serviceCode === 'SELF-KERING' ? `${machines} dryer` : item.serviceCode === 'SELF-CUCI-KERING' ? `${machines} washer + ${machines} dryer` : `${machines} mesin`
          return <div className="checkout-self-service-weight" key={item.cartKey}>
            <label htmlFor={`checkout-weight-${item.cartKey}`}>Berat {item.name} (kg)</label>
            <input id={`checkout-weight-${item.cartKey}`} type="number" min="0.01" max="9999.99" step="0.01" required value={item.weightKg} onChange={event => changeLineWeight(item.cartKey, event.target.value)} placeholder="Masukkan berat aktual"/>
            <small>{machines ? `${machineLabel} · kapasitas 7 kg per mesin` : 'Jumlah mesin dihitung setelah berat diisi'}</small>
          </div>
        })}
        {cart.some(isSelfServiceItem) && <p className="machine-count-note">Berat dan jumlah mesin Self Service dihitung terpisah untuk setiap baris layanan.</p>}
        <label className="checkout-notes">Catatan<textarea maxLength="2000" rows="2" value={checkoutDetails.notes} onChange={e => setCheckoutDetails({ ...checkoutDetails, notes: e.target.value })} placeholder="Catatan pesanan (opsional)"/></label>
        <label>Ongkir<input type="number" min="0" step="0.01" value={checkoutDetails.deliveryFee} onChange={e => setCheckoutDetails({ ...checkoutDetails, deliveryFee: e.target.value })}/></label>
        <label>Diskon nominal<input type="number" min="0" step="0.01" value={checkoutDetails.discountAmount} onChange={e => setCheckoutDetails({ ...checkoutDetails, discountAmount: e.target.value })}/></label>
      </div>
      </div>
      <div className="checkout-payment-column"><div className="method-label">Metode pembayaran</div><div className="payment-methods"><button className={`method-card ${method === 'Tunai' ? 'chosen' : ''}`} onClick={() => setMethod('Tunai')} disabled={submitting}><div className="method-icon cash"><Wallet size={19}/></div><span><b>Tunai</b><small>Bayar langsung</small></span><span className="radio-dot"/></button><button className={`method-card ${method === 'QRIS' ? 'chosen' : ''}`} onClick={() => setMethod('QRIS')} disabled={submitting}><div className="method-icon qris"><CreditCard size={19}/></div><span><b>QRIS</b><small>Belum diverifikasi</small></span><span className="radio-dot"/></button></div>
      {method === 'Tunai' ? <div className="cash-section"><label>Uang diterima<input value={cash} onChange={e => setCash(e.target.value)} placeholder="Masukkan nominal" inputMode="numeric" /></label><div className="quick-cash">{[total, 50000, 100000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(n => <button key={n} onClick={() => setCash(String(n))}>{n === total ? 'Uang pas' : money(n)}</button>)}</div><div className="change-row"><span>Kembalian</span><b>{money(Math.max(0, Number(cash || 0) - total))}</b></div></div> : <div className="qris-box"><CreditCard size={21}/><span><b>Konfirmasi QRIS melalui speaker</b><small>Tunggu speaker pembayaran berbunyi dan pastikan nominal sesuai. Setelah itu pilih konfirmasi QRIS. Jika belum terdengar, simpan transaksi sebagai belum dibayar.</small></span></div>}
      {!checkoutWeightsValid && <div className="checkout-error" role="alert">Isi berat yang valid untuk setiap baris layanan sebelum menyimpan transaksi.</div>}
      {checkoutError && <div className="checkout-error" role="alert">{checkoutError}</div>}
      <button className="btn btn-primary confirm-payment" onClick={() => paid(method === 'QRIS' ? 'qris' : 'tunai', method === 'QRIS')} disabled={submitting || !checkoutWeightsValid || (method === 'Tunai' && Number(cash || 0) < total) || (method === 'QRIS' && total <= 0)}><Check size={17}/>{submitting ? 'Menyimpan transaksi…' : method === 'Tunai' ? 'Konfirmasi pembayaran tunai' : 'Speaker berbunyi · Konfirmasi QRIS'}</button>
      <button className="btn btn-secondary confirm-payment" onClick={() => paid(method === 'QRIS' ? 'qris' : null)} disabled={submitting || !checkoutWeightsValid}>{submitting ? 'Menyimpan transaksi…' : method === 'QRIS' ? 'Simpan QRIS belum dibayar' : 'Simpan sebagai belum dibayar'}</button>
      <div className="modal-secure"><Check size={13}/> Keranjang hanya dikosongkan setelah transaksi berhasil disimpan.</div>
      </div>
      </div>
    </section></div>}
    {shiftCloseConfirm && <ShiftCloseConfirmation
      shift={shiftCloseConfirm}
      closing={closingShift}
      error={serverError}
      onCancel={() => setShiftCloseConfirm(null)}
      onConfirm={closeShift}
    />}
    {success && <div className="modal-backdrop"><section className="payment-modal transaction-success" role="dialog" aria-modal="true" aria-labelledby="transaction-success-title"><div className="success-icon"><Check size={24}/></div><h2 id="transaction-success-title">Transaksi berhasil disimpan</h2><p>Nomor transaksi <b>{success.number}</b></p><p>Status pembayaran: <b>{success.paymentStatus === 'lunas' ? 'Lunas' : 'Belum dibayar'}</b></p>{success.membershipStamp?.message && <p className="membership-success-note">{success.membershipStamp.message}</p>}<div className="success-actions"><button className="btn btn-secondary" onClick={() => window.print()}><Printer size={16}/> Cetak struk pembayaran</button><button className="btn btn-primary" onClick={() => { setSuccess(null); selectNav('Riwayat Transaksi') }}>Lihat riwayat transaksi</button><button className="btn btn-secondary" onClick={() => setSuccess(null)}>Selesai</button></div><ReceiptPrint receipt={success.receipt} transactionNumber={success.number}/></section></div>}
  </div>
}

function ReceiptPrint({ receipt, transactionNumber }) {
  const printedAt = receipt.createdAt
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(receipt.createdAt))
    : 'Waktu transaksi tidak tersedia'
  const paymentMethod = receipt.paymentMethod === 'tunai' ? 'Tunai' : receipt.paymentMethod === 'qris' ? 'QRIS' : 'Belum dibayar'

  return <article className="receipt-print" aria-label="Struk pembayaran">
    <header className="receipt-print-header">
      <b>KINO LAUNDRY</b>
      <span>STRUK PEMBAYARAN</span>
    </header>
    <div className="receipt-print-meta">
      <div><span>No. transaksi</span><b>{transactionNumber}</b></div>
      <div><span>Tanggal</span><b>{printedAt}</b></div>
      <div><span>Kasir</span><b>{receipt.cashierName}</b></div>
      <div><span>Pelanggan</span><b>{receipt.customerName}</b></div>
      {receipt.customerPhone && <div><span>Telepon</span><b>{receipt.customerPhone}</b></div>}
      {receipt.memberNumber && <div><span>Member</span><b>{receipt.memberNumber}</b></div>}
    </div>
    <div className="receipt-print-items">
      {receipt.items.map((item, index) => <div className="receipt-print-item" key={`${item.name}-${index}`}>
        <b>{item.name}</b>
        <span>{item.detail}</span>
        <strong>{money(item.subtotal)}</strong>
      </div>)}
    </div>
    <div className="receipt-print-summary">
      {receipt.totalWeightKg !== null && <div><span>Total berat</span><b>{Number(receipt.totalWeightKg).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg</b></div>}
      <div><span>Subtotal</span><b>{money(receipt.subtotal)}</b></div>
      {receipt.deliveryFee > 0 && <div><span>Ongkir</span><b>{money(receipt.deliveryFee)}</b></div>}
      {receipt.discountAmount > 0 && <div><span>Diskon</span><b>− {money(receipt.discountAmount)}</b></div>}
      <div className="receipt-print-total"><span>Total</span><b>{money(receipt.total)}</b></div>
      <div><span>Metode</span><b>{paymentMethod}</b></div>
      <div><span>Status</span><b>{receipt.paymentStatus === 'lunas' ? 'Lunas' : 'Belum dibayar'}</b></div>
      {receipt.paymentStatus === 'lunas' && receipt.paymentMethod === 'tunai' && <>
        <div><span>Uang diterima</span><b>{money(receipt.cashReceived)}</b></div>
        <div><span>Kembalian</span><b>{money(receipt.change)}</b></div>
      </>}
    </div>
    <footer>Terima kasih telah menggunakan layanan KINO Laundry.</footer>
  </article>
}

function ShiftCloseConfirmation({ shift, closing, error, onCancel, onConfirm }) {
  const label = shift.shift_type ? `Shift ${shift.shift_type.charAt(0).toUpperCase()}${shift.shift_type.slice(1)}` : 'Shift aktif'
  const startedAt = shift.started_at
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(shift.started_at))
    : 'Waktu mulai tidak tersedia'

  return <div className="shift-close-confirm-backdrop" onMouseDown={event => event.target === event.currentTarget && !closing && onCancel()}>
    <section className="shift-close-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="shift-close-confirm-title" tabIndex={-1} onKeyDown={event => event.key === 'Escape' && !closing && onCancel()}>
      <div className="shift-close-confirm-icon"><AlertTriangle size={22}/></div>
      <div className="shift-close-confirm-kicker">KONFIRMASI TUTUP SHIFT</div>
      <h2 id="shift-close-confirm-title">Tutup {label}?</h2>
      <p>Pastikan sesi yang akan ditutup adalah shift yang benar.</p>
      <div className="shift-close-confirm-details">
        <div><span>Jenis shift</span><b>{label}</b></div>
        <div><span>Nomor sesi</span><b>#{shift.id}</b></div>
        <div><span>Mulai aktual</span><b>{startedAt}</b></div>
      </div>
      <div className="shift-close-confirm-note">Setelah dikonfirmasi, sesi ini ditutup dan ringkasan penerimaan serta pengeluaran akan ditampilkan.</div>
      {error && <div className="checkout-error" role="alert">{error}</div>}
      <div className="shift-close-confirm-actions">
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={closing} autoFocus>Batal</button>
        <button className="btn btn-danger" type="button" onClick={onConfirm} disabled={closing}>{closing ? 'Menutup shift…' : `Ya, tutup ${label.toLowerCase()}`}</button>
      </div>
    </section>
  </div>
}

function ShiftCloseSummary({ result, cashierName, dark, onContinue }) {
  const [shareStatus, setShareStatus] = useState('')
  const { transactions, payments, coins } = result.summary
  const shiftLabel = `Shift ${(result.shift.shift_type || '').charAt(0).toUpperCase()}${(result.shift.shift_type || '').slice(1)}`
  const dateTime = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—'
  const reportText = [
    'KINO LAUNDRY · LAPORAN TUTUP SHIFT',
    `Sesi: #${result.shift.id} · ${shiftLabel}`,
    `Kasir: ${cashierName || 'Kasir'}`,
    `Mulai: ${dateTime(result.shift.started_at)}`,
    `Selesai: ${dateTime(result.shift.ended_at)}`,
    '',
    `Transaksi: ${transactions.transactions}`,
    `Pembayaran diterima: ${money(payments.received_total)}`,
    `Tunai: ${money(payments.cash)} · QRIS: ${money(payments.qris)}`,
    `Pengeluaran: ${result.summary.expense_ledger_ready ? money(result.summary.expenses.total) : 'Belum tersedia'}`,
    `Pengeluaran dari laci kas: ${result.summary.expense_ledger_ready ? money(result.summary.expenses.cash) : 'Belum tersedia'}`,
    `Arus tunai setelah pengeluaran laci: ${result.summary.expense_ledger_ready ? money(Number(payments.cash || 0) - Number(result.summary.expenses.cash || 0)) : 'Belum tersedia'}`,
    `Tagihan belum lunas: ${transactions.unpaid_count} transaksi · ${money(transactions.unpaid_total)}`,
    `Koin masuk: ${coins.coins_in} · Koin keluar: ${coins.coins_out}`,
    '',
    'Catatan: laporan ini bukan rekonsiliasi fisik kas/koin atau laporan laba.',
  ].join('\n')
  const shareReport = async () => {
    setShareStatus('')
    try {
      if (navigator.share) {
        await navigator.share({ title: `Laporan ${shiftLabel} · KINO Laundry`, text: reportText })
        setShareStatus('Laporan siap dibagikan.')
        return
      }
      const link = document.createElement('a')
      link.href = `https://wa.me/?text=${encodeURIComponent(reportText)}`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
      setShareStatus('WhatsApp terbuka. Pilih grup tujuan lalu kirim laporan.')
      return
    } catch (error) {
      if (error.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(reportText)
        setShareStatus('Laporan disalin. Tempelkan ke grup WhatsApp tujuan.')
      } catch {
        setShareStatus('Laporan tidak dapat dibagikan. Coba cetak laporan.')
      }
    }
  }
  const printReport = () => {
    const previousTitle = document.title
    document.title = `Laporan ${shiftLabel} - KINO Laundry`
    window.print()
    window.setTimeout(() => { document.title = previousTitle }, 1000)
  }
  return <main className={`owner-login-page shift-close-page ${dark ? 'dark' : ''}`}>
    <section className="owner-login-card attendance-card shift-close-card">
      <div className="attendance-body shift-close-body">
        <header className="shift-report-heading">
          <div className="shift-report-brand"><span className="shift-report-mark"><WashingMachine size={20}/></span><span><b>KINO LAUNDRY</b><small>RINGKASAN OPERASIONAL</small></span></div>
          <span className="shift-report-status"><Check size={14}/> Shift selesai</span>
        </header>
        <div className="shift-report-title">
          <div><span className="shift-report-kicker">LAPORAN AKHIR SHIFT</span><h1>{shiftLabel} ditutup</h1><p>Sesi #{result.shift.id} · {cashierName || 'Kasir'}</p></div>
          <div className="shift-report-period"><span>Mulai</span><b>{dateTime(result.shift.started_at)}</b><span>Selesai</span><b>{dateTime(result.shift.ended_at)}</b></div>
        </div>

        <section className="shift-report-highlights" aria-label="Ringkasan utama">
          <article><span>Total transaksi</span><b>{transactions.transactions}</b><small>{transactions.unpaid_count} belum lunas</small></article>
          <article><span>Pembayaran diterima</span><b>{money(payments.received_total)}</b><small>Nilai pembayaran tercatat</small></article>
          <article><span>Tagihan belum lunas</span><b>{money(transactions.unpaid_total)}</b><small>{transactions.unpaid_count} transaksi</small></article>
        </section>

        <div className="shift-report-columns">
          <section className="shift-report-section">
            <h2>Pembayaran</h2>
            <ReportRow label="Tunai diterima" value={money(payments.cash)}/>
            <ReportRow label="QRIS diterima" value={money(payments.qris)}/>
            <ReportRow label="Total diterima" value={money(payments.received_total)} strong/>
          </section>
          <section className="shift-report-section">
            <h2>Pengeluaran & arus tunai</h2>
            <ReportRow label="Total pengeluaran" value={result.summary.expense_ledger_ready ? money(result.summary.expenses.total) : 'Belum tersedia'}/>
            <ReportRow label="Dari laci kas" value={result.summary.expense_ledger_ready ? money(result.summary.expenses.cash) : 'Belum tersedia'}/>
            <ReportRow label="Arus tunai setelah pengeluaran laci" value={result.summary.expense_ledger_ready ? money(Number(payments.cash || 0) - Number(result.summary.expenses.cash || 0)) : 'Belum tersedia'} strong/>
          </section>
          <section className="shift-report-section">
            <h2>Mutasi koin</h2>
            <ReportRow label="Koin masuk" value={coins.coins_in}/>
            <ReportRow label="Koin keluar" value={coins.coins_out}/>
          </section>
          <section className="shift-report-section shift-report-note">
            <h2>Catatan</h2>
            <p>Arus tunai bukan laba usaha. Rekonsiliasi fisik kas/koin dan serah terima belum tersedia pada laporan ini.</p>
          </section>
        </div>
        <div className="shift-report-actions">
          <button type="button" className="shift-report-share" onClick={shareReport}><Share2 size={17}/> Bagikan ke grup</button>
          <button type="button" className="shift-report-print" onClick={printReport}><Printer size={17}/> Cetak / Simpan PDF</button>
          <button type="button" className="shift-report-continue" onClick={onContinue}>Lanjutkan ke buka shift <ArrowRight size={17}/></button>
        </div>
        {shareStatus && <p className="shift-report-share-status" role="status">{shareStatus}</p>}
      </div>
    </section>
  </main>
}

function ReportRow({ label, value, strong = false }) {
  return <div className={`shift-report-row ${strong ? 'strong' : ''}`}><span>{label}</span><b>{value}</b></div>
}
