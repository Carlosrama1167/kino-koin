import { Activity, Clock3, Droplets, Package, Shirt, ShoppingBag, Sparkles, WashingMachine } from 'lucide-react'

export const categories = ['Self Service', 'Drop Off', 'Cuci Kering Setrika', 'Setrika Saja', 'Produk & Minuman']

// Harga mengikuti aturan yang telah dikonfirmasi di PRD. Harga minuman masih placeholder katalog.
export const services = {
  'Self Service': [
    { name: 'Cuci', note: '30 menit · maks. 7 kg', price: 7000, icon: WashingMachine, color: 'blue', unit: 'siklus' },
    { name: 'Kering', note: '45 menit · maks. 7 kg', price: 10000, icon: Sparkles, color: 'cyan', unit: 'siklus' },
    { name: 'Cuci + Kering', note: '75 menit · maks. 7 kg', price: 16000, nightPrice: 14000, icon: Droplets, color: 'violet', unit: 'siklus' },
    { name: 'Extra Spin', note: 'Tambahan putaran', price: 4000, icon: Activity, color: 'orange', unit: 'siklus' },
    { name: 'Extra Dry', note: 'Tambahan 20 menit', price: 5000, icon: Clock3, color: 'pink', unit: 'siklus' },
  ],
  'Drop Off': [
    { name: 'Cuci + Kering', note: 'Per muatan · maks. 7 kg', price: 20000, nightPrice: 18000, icon: WashingMachine, color: 'blue', unit: 'muatan' },
    { name: 'Lipat Pakaian', note: 'Tambahan per kilogram', price: 1500, icon: Shirt, color: 'cyan', unit: 'kg' },
  ],
  'Cuci Kering Setrika': [
    { name: 'Reguler', note: 'Estimasi 2–3 hari · min. 4 kg', price: 6000, icon: Shirt, color: 'blue', unit: 'kg' },
    { name: 'Express', note: 'Estimasi 24 jam · min. 4 kg', price: 8000, icon: Clock3, color: 'orange', unit: 'kg' },
    { name: 'Kilat', note: 'Estimasi 12 jam · min. 4 kg', price: 10000, icon: Sparkles, color: 'violet', unit: 'kg' },
  ],
  'Setrika Saja': [
    { name: 'Setrika Reguler', note: 'Per kilogram', price: 4000, icon: Shirt, color: 'blue', unit: 'kg' },
    { name: 'Setrika Express', note: 'Per kilogram', price: 6000, icon: Clock3, color: 'orange', unit: 'kg' },
  ],
  'Produk & Minuman': [
    { name: 'Sabun', note: 'Per buah', price: 1500, icon: Sparkles, color: 'cyan', unit: 'pcs' },
    { name: 'Softener', note: 'Per buah', price: 1500, icon: Droplets, color: 'violet', unit: 'pcs' },
    { name: 'Kresek', note: 'Per buah', price: 2000, icon: ShoppingBag, color: 'orange', unit: 'pcs' },
    { name: 'Air Mineral', note: 'Harga katalog', price: null, icon: Droplets, color: 'blue', unit: 'pcs', unavailable: true },
    { name: 'Teh', note: 'Harga katalog', price: null, icon: Sparkles, color: 'pink', unit: 'pcs', unavailable: true },
    { name: 'Kopi', note: 'Harga katalog', price: null, icon: Sparkles, color: 'orange', unit: 'pcs', unavailable: true },
    { name: 'Susu', note: 'Harga katalog', price: null, icon: Droplets, color: 'cyan', unit: 'pcs', unavailable: true },
    { name: 'Soda', note: 'Harga katalog', price: null, icon: Sparkles, color: 'violet', unit: 'pcs', unavailable: true },
    { name: 'Minuman Isotonik', note: 'Harga katalog', price: null, icon: Droplets, color: 'blue', unit: 'pcs', unavailable: true },
  ],
}

export const navGroups = [
  { label: 'Menu utama', items: [{ name: 'Dashboard' }, { name: 'Transaksi Baru' }, { name: 'Pesanan Laundry' }, { name: 'Riwayat Transaksi' }] },
  { label: 'Operasional', items: [{ name: 'Produk & Stok' }, { name: 'Manajemen Koin' }, { name: 'Pengeluaran' }, { name: 'Laporan' }] },
]
