import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowRight, Bell, Check, ChevronDown, CircleHelp, Clock3, Coins, CreditCard, LayoutDashboard, LogOut, Menu, Moon, Package, Plus, Search, Settings2, Shirt, ShoppingBag, ShoppingCart, Sparkles, Sun, Trash2, UserRound, Wallet, WashingMachine, X, ReceiptText } from 'lucide-react'
import { categories, navGroups, services } from './data/catalog'
import OrderManagement from './components/OrderManagement'
import CashierDashboard from './components/CashierDashboard'
import TransactionHistory from './components/TransactionHistory'
import InventoryManagement from './components/InventoryManagement'
import CoinManagement from './components/CoinManagement'
import SettingsPage from './components/SettingsPage'
import HelpPage from './components/HelpPage'
import ShiftReports from './components/ShiftReports'
import ExpensePage from '../../shared/ExpenseManagement'
import { api } from '../../shared/api'
import './styles/checkout.css'

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
  const selfServiceMachineCount = Number(checkoutDetails.weightKg) > 0 ? Math.ceil(Number(checkoutDetails.weightKg) / 7) : 1
  const lineQuantity = (item) => {
    if (item.unit === 'kg') return Number(checkoutDetails.weightKg || 0) * item.qty
    if (item.serviceCategory === 'Self Service' && item.unit === 'siklus' && Number(checkoutDetails.weightKg) > 0) return selfServiceMachineCount * item.qty
    return item.qty
  }
  const coinEstimate = cart.reduce((needs, item) => {
    if (item.serviceCategory !== 'Self Service') return needs
    const machines = selfServiceMachineCount * item.qty
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
    const currentServiceCategory = cart.find(item => item.serviceId)?.serviceCategory
    if (service.serviceId && currentServiceCategory && service.serviceCategory !== currentServiceCategory) {
      notify('Selesaikan satu jenis layanan utama sebelum menambahkan kategori cucian lain.')
      return
    }
    const primaryCodes = ['SELF-CUCI', 'SELF-KERING', 'SELF-CUCI-KERING']
    if (primaryCodes.includes(service.serviceCode) && cart.some(item => primaryCodes.includes(item.serviceCode) && item.serviceCode !== service.serviceCode)) {
      notify('Pilih satu layanan utama untuk kelompok cucian ini.')
      return
    }
    setCart(current => {
      const found = current.find(i => i.id === service.id)
      return found ? current.map(i => i.id === service.id ? { ...i, qty: i.qty + 1 } : i) : [...current, { ...service, qty: 1 }]
    })
    notify(`${service.name} ditambahkan`)
  }
  const changeQty = (id, delta) => setCart(current => current.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0))
  const selectNav = (name) => { setActive(name); setMobileMenu(false) }
  const paid = async (paymentMethod = method === 'QRIS' ? 'qris' : 'tunai') => {
    const payload = {
      payment_method: paymentMethod,
      cash_received: paymentMethod === 'tunai' ? Number(cash || 0) : 0,
      customer_name: checkoutDetails.customerName.trim(),
      customer_phone: checkoutDetails.customerPhone.trim(),
      weight_kg: checkoutDetails.weightKg === '' ? null : Number(checkoutDetails.weightKg),
      notes: checkoutDetails.notes.trim(),
      delivery_fee: deliveryFee,
      discount_amount: discountAmount,
      items: cart.map(item => ({ service_id: item.serviceId, product_id: item.productId, quantity: item.qty })),
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
      const transaction = result.transaction
      setPayment(false)
      setCart([])
      setCash('')
      setCheckoutDetails({ customerName: '', customerPhone: '', weightKg: '', notes: '', deliveryFee: '0', discountAmount: '0' })
      requestRef.current = null
      setSuccess({ number: transaction.transaction_number, paymentStatus: transaction.payment_status })
    } catch (error) {
      setCheckoutError(error.message)
    } finally {
      setSubmitting(false)
    }
  }
  const openShift=async()=>{try{const r=await api('/api/shifts/open',{method:'POST',body:JSON.stringify({shift_type:shiftType})});setShift(r.shift);setClosedShift(null);setServerError('')}catch(e){setServerError(e.message)}}
  const closeShift=async()=>{
    if(!window.confirm('Tutup sesi shift sekarang? Penerimaan aktual akan diringkas, tanpa rekonsiliasi fisik.'))return
    setClosingShift(true);setServerError('')
    try{const result=await api('/api/shifts/close',{method:'POST',body:'{}'});setClosedShift(result);setShift(null)}
    catch(e){setServerError(e.message)}
    finally{setClosingShift(false)}
  }
  if(shift===undefined)return <div className="auth-loading">Menghubungkan ke data kasir…</div>
  if(!shift && closedShift)return <ShiftCloseSummary result={closedShift} onContinue={()=>setClosedShift(null)}/>
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
          {active === 'Pesanan Laundry' ? <OrderManagement notify={notify}/> : active === 'Riwayat Transaksi' ? <TransactionHistory notify={notify}/> : active === 'Produk & Stok' ? <InventoryManagement notify={notify}/> : active === 'Manajemen Koin' ? <CoinManagement notify={notify}/> : active === 'Laporan' ? <ShiftReports notify={notify}/> : active === 'Pengeluaran' ? <ExpensePage notify={notify}/> : active === 'Pengaturan' ? <SettingsPage dark={dark} onTheme={setDark} notify={notify}/> : active === 'Bantuan' ? <HelpPage/> : active === 'Dashboard' ? <CashierDashboard onNavigate={selectNav} onCloseShift={closeShift} closing={closingShift} /> : <>
          <section className="pos-card">
            <div className="pos-header"><div><div className="section-overline">LAYANAN & PRODUK</div><h3>Mulai transaksi</h3><p>Pilih layanan untuk ditambahkan ke keranjang.</p></div><div className={`pricing-badge ${nightPricing ? 'night-pricing' : ''}`}><span className="price-sun">☼</span> Harga {nightPricing ? 'malam aktif' : 'normal'} <ChevronDown size={13}/></div></div>
            <div className="category-tabs">{categories.map((c, i) => <button className={`category-tab ${category === c ? 'selected' : ''}`} onClick={() => { setCategory(c); setQuery('') }} key={c}>{i === 0 ? <WashingMachine size={15}/> : i === 1 ? <Shirt size={15}/> : i === 4 ? <ShoppingBag size={15}/> : <Sparkles size={15}/>}<span>{c}</span></button>)}</div>
            {category === 'Self Service' && <div className="machine-note"><div className="note-bubble"><WashingMachine size={15}/></div><span><b>Mesin tersedia</b><small>5 mesin cuci <i/> 7 mesin pengering</small></span><div className="capacity-note">Kapasitas maks. <b>7 kg</b></div></div>}
            {category === 'Drop Off' && <div className="machine-note"><div className="note-bubble"><UserRound size={15}/></div><span><b>Detail pesanan</b><small>Nama, berat, catatan, ongkir, dan diskon diisi sebelum transaksi disimpan.</small></span></div>}
            <div className="service-toolbar"><div className="service-caption"><b>{category}</b><span>{filteredServices.length} pilihan aktif</span></div><label className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari layanan..." /></label></div>
            {catalogError && <div className="checkout-error" role="alert">Katalog belum dapat dimuat: {catalogError}</div>}
            <div className="service-grid">{filteredServices.map(s => <button className="service-card" key={s.id} disabled={s.unavailable} onClick={() => addItem(s)}><div className={`service-icon ${s.color || 'blue'}`}><Icon icon={s.icon || Package} size={20}/>{!s.unavailable && <span className="service-add"><Plus size={13}/></span>}</div><b className="service-name">{s.name}</b><span className="service-note">{s.note || `Layanan per ${s.unit}`}</span><div className="service-price">{s.unavailable ? 'Stok habis' : money(s.price)}{!s.unavailable && <small>/{s.unit}</small>}</div></button>)}{!filteredServices.length && <div className="empty-search">{catalogError ? 'Katalog tidak tersedia.' : 'Tidak ada layanan aktif pada kategori ini.'}</div>}</div>
            {category === 'Self Service' && <div className="coin-note"><div className="coin-stack"><Coins size={17}/></div><span><b>Sistem koin praktis</b><small>1 koin reguler per mesin; Cuci + Kering memakai 2 koin reguler per pasangan mesin. Extra Dry memakai 1 koin khusus per pengering.</small>{Number(checkoutDetails.weightKg) > 0 && <small>Kebutuhan: {coinEstimate.regular} koin reguler + {coinEstimate.extraDry} koin Extra Dry.</small>}</span><button onClick={() => selectNav('Manajemen Koin')}>Info koin <ArrowRight size={13}/></button></div>}
          </section>
          </>}
        </section>

        {!['Pesanan Laundry', 'Riwayat Transaksi', 'Produk & Stok', 'Manajemen Koin', 'Laporan', 'Pengeluaran', 'Pengaturan', 'Bantuan', 'Dashboard'].includes(active) && <aside className={`cart-panel ${cartOpen ? 'cart-open' : ''}`}><div className="cart-header"><div><div className="cart-title"><h3>Keranjang</h3><span className="cart-count">{cart.reduce((n, i) => n + i.qty, 0)}</span></div><p>Transaksi baru · Nomor dibuat saat tersimpan</p></div><button className="icon-button cart-close" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang"><X size={18}/></button><button className="clear-button" onClick={() => setCart([])} disabled={!cart.length}><Trash2 size={14}/> Kosongkan</button></div>
          <div className="cart-customer"><div className="customer-icon"><UserRound size={16}/></div><div><b>{checkoutDetails.customerName || 'Pelanggan umum'}</b><small>{checkoutDetails.customerPhone || 'Data pelanggan diisi saat checkout'}</small></div><button className="edit-customer" onClick={() => { setCheckoutError(''); setPayment(true) }}>Ubah</button></div>
          <div className="cart-items">{cart.length === 0 ? <div className="cart-empty"><div className="empty-illustration"><ShoppingCart size={27}/><span><Plus size={12}/></span></div><b>Keranjang masih kosong</b><p>Pilih layanan atau produk untuk memulai transaksi.</p></div> : cart.map(item => { const quantity = lineQuantity(item); return <div className="cart-line" key={item.id}><div className={`line-icon ${item.color}`}><Icon icon={item.icon} size={17}/></div><div className="line-details"><b>{item.name}</b><small>{money(item.price)} / {item.unit}</small><div className="qty-control"><button onClick={() => changeQty(item.id, -1)} aria-label={`Kurangi ${item.name}`}>−</button><span>{item.unit === 'kg' ? `${quantity} kg` : quantity}</span><button onClick={() => changeQty(item.id, 1)} aria-label={`Tambah ${item.name}`}>+</button></div></div><b className="line-total">{money(item.price * quantity)}</b></div> })}</div>
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
    {payment && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && !submitting && setPayment(false)}><section className="payment-modal" aria-labelledby="checkout-title"><div className="modal-header"><div><div className="section-overline">KONFIRMASI TRANSAKSI</div><h2 id="checkout-title">Detail & pembayaran</h2><p>Periksa rincian. Harga dan total akan divalidasi kembali oleh server.</p></div><button className="icon-button" onClick={() => setPayment(false)} disabled={submitting} aria-label="Tutup"><X size={19}/></button></div><div className="payment-total"><small>Total tagihan</small><b>{money(total)}</b><span>Nomor transaksi dibuat setelah tersimpan</span></div>
      <div className="checkout-landscape-grid">
      <div className="checkout-info-column"><div className="checkout-details">
        <label>Nama pelanggan (opsional)<input maxLength="100" value={checkoutDetails.customerName} onChange={e => setCheckoutDetails({ ...checkoutDetails, customerName: e.target.value })} placeholder="Nama pelanggan"/></label>
        <label>Nomor telepon (opsional)<input maxLength="30" value={checkoutDetails.customerPhone} onChange={e => setCheckoutDetails({ ...checkoutDetails, customerPhone: e.target.value })} placeholder="08xx xxxx xxxx"/></label>
        {cart.some(item => item.serviceId) && <label>Berat laundry (kg)<input type="number" min="0.01" max="9999.99" step="0.01" required value={checkoutDetails.weightKg} onChange={e => setCheckoutDetails({ ...checkoutDetails, weightKg: e.target.value })} placeholder="Masukkan berat aktual"/></label>}
        {cart.some(item => ['SELF-CUCI', 'SELF-KERING', 'SELF-CUCI-KERING', 'SELF-EXTRA-DRY'].includes(item.serviceCode)) && Number(checkoutDetails.weightKg) > 0 && <p className="machine-count-note">Berdasarkan kapasitas 7 kg, estimasi <b>{selfServiceMachineCount} mesin</b> untuk layanan terpilih; tarif siklus dan kebutuhan koin mengikuti jumlah mesin.</p>}
        <label className="checkout-notes">Catatan<textarea maxLength="2000" rows="2" value={checkoutDetails.notes} onChange={e => setCheckoutDetails({ ...checkoutDetails, notes: e.target.value })} placeholder="Catatan pesanan (opsional)"/></label>
        <label>Ongkir<input type="number" min="0" step="0.01" value={checkoutDetails.deliveryFee} onChange={e => setCheckoutDetails({ ...checkoutDetails, deliveryFee: e.target.value })}/></label>
        <label>Diskon nominal<input type="number" min="0" step="0.01" value={checkoutDetails.discountAmount} onChange={e => setCheckoutDetails({ ...checkoutDetails, discountAmount: e.target.value })}/></label>
      </div>
      </div>
      <div className="checkout-payment-column"><div className="method-label">Metode pembayaran</div><div className="payment-methods"><button className={`method-card ${method === 'Tunai' ? 'chosen' : ''}`} onClick={() => setMethod('Tunai')} disabled={submitting}><div className="method-icon cash"><Wallet size={19}/></div><span><b>Tunai</b><small>Bayar langsung</small></span><span className="radio-dot"/></button><button className={`method-card ${method === 'QRIS' ? 'chosen' : ''}`} onClick={() => setMethod('QRIS')} disabled={submitting}><div className="method-icon qris"><CreditCard size={19}/></div><span><b>QRIS</b><small>Belum diverifikasi</small></span><span className="radio-dot"/></button></div>
      {method === 'Tunai' ? <div className="cash-section"><label>Uang diterima<input value={cash} onChange={e => setCash(e.target.value)} placeholder="Masukkan nominal" inputMode="numeric" /></label><div className="quick-cash">{[total, 50000, 100000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(n => <button key={n} onClick={() => setCash(String(n))}>{n === total ? 'Uang pas' : money(n)}</button>)}</div><div className="change-row"><span>Kembalian</span><b>{money(Math.max(0, Number(cash || 0) - total))}</b></div></div> : <div className="qris-box"><CreditCard size={21}/><span><b>QRIS belum terverifikasi</b><small>Transaksi akan tersimpan dengan status belum dibayar. Jangan serahkan barang sebagai lunas sebelum pembayaran diverifikasi.</small></span></div>}
      {checkoutError && <div className="checkout-error" role="alert">{checkoutError}</div>}
      <button className="btn btn-primary confirm-payment" onClick={() => paid()} disabled={submitting || (method === 'Tunai' && Number(cash || 0) < total)}><Check size={17}/>{submitting ? 'Menyimpan transaksi…' : method === 'Tunai' ? 'Konfirmasi pembayaran tunai' : 'Simpan QRIS belum terverifikasi'}</button>
      <button className="btn btn-secondary confirm-payment" onClick={() => paid(null)} disabled={submitting}>{submitting ? 'Menyimpan transaksi…' : 'Simpan sebagai belum dibayar'}</button>
      <div className="modal-secure"><Check size={13}/> Keranjang hanya dikosongkan setelah transaksi berhasil disimpan.</div>
      </div>
      </div>
    </section></div>}
    {success && <div className="modal-backdrop"><section className="payment-modal transaction-success" role="dialog" aria-modal="true" aria-labelledby="transaction-success-title"><div className="success-icon"><Check size={24}/></div><h2 id="transaction-success-title">Transaksi berhasil disimpan</h2><p>Nomor transaksi <b>{success.number}</b></p><p>Status pembayaran: <b>{success.paymentStatus === 'lunas' ? 'Lunas' : 'Belum dibayar'}</b></p><div className="success-actions"><button className="btn btn-primary" onClick={() => { setSuccess(null); selectNav('Riwayat Transaksi') }}>Lihat riwayat transaksi</button><button className="btn btn-secondary" onClick={() => setSuccess(null)}>Selesai</button></div></section></div>}
  </div>
}

function ShiftCloseSummary({ result, onContinue }) {
  const { transactions, payments, coins } = result.summary
  return <main className="owner-login-page">
    <section className="owner-login-card attendance-card">
      <div className="attendance-body shift-close-summary">
        <div className="owner-form-kicker">KINO LAUNDRY · REKAP SHIFT</div>
        <h1>Shift ditutup</h1>
        <p>Shift {result.shift.shift_type} · {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(result.shift.started_at))}</p>
        <div className="shift-close-result-row"><span>Transaksi</span><b>{transactions.transactions}</b></div>
        <div className="shift-close-result-row"><span>Pembayaran diterima</span><b>{money(payments.received_total)}</b></div>
        <div className="shift-close-result-row"><span>Tunai · QRIS</span><b>{money(payments.cash)} · {money(payments.qris)}</b></div>
        <div className="shift-close-result-row"><span>Pengeluaran · dari laci kas</span><b>{result.summary.expense_ledger_ready ? `${money(result.summary.expenses.total)} · ${money(result.summary.expenses.cash)}` : 'Belum tersedia'}</b></div>
        <div className="shift-close-result-row"><span>Arus tunai setelah expense laci</span><b>{result.summary.expense_ledger_ready ? money(Number(payments.cash || 0) - Number(result.summary.expenses.cash || 0)) : 'Belum tersedia'}</b></div>
        <div className="shift-close-result-row"><span>Tagihan belum lunas</span><b>{transactions.unpaid_count} · {money(transactions.unpaid_total)}</b></div>
        <div className="shift-close-result-row"><span>Koin masuk · keluar</span><b>{coins.coins_in} · {coins.coins_out}</b></div>
        <p>Rekonsiliasi fisik kas/koin dan serah terima belum tersedia. Catatan shift tidak ditutup otomatis.</p>
        <button className="owner-signin-button attendance-action" onClick={onContinue}>Lanjutkan ke buka shift</button>
      </div>
    </section>
  </main>
}
