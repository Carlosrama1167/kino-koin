// Jumlah stok adalah data contoh untuk UI; harga hanya diisi jika sudah ditetapkan di PRD.
export const mockInventory = [
  { id: 'sabun', name: 'Sabun', category: 'Laundry', stock: 24, unit: 'pcs', minimum: 10, price: 1500, updated: '30 Okt, 08:40' },
  { id: 'softener', name: 'Softener', category: 'Laundry', stock: 8, unit: 'pcs', minimum: 10, price: 1500, updated: '30 Okt, 07:15' },
  { id: 'kresek', name: 'Kresek', category: 'Laundry', stock: 45, unit: 'pcs', minimum: 15, price: 2000, updated: '29 Okt, 20:10' },
  { id: 'air-mineral', name: 'Air Mineral', category: 'Minuman', stock: 12, unit: 'botol', minimum: 8, price: null, updated: '29 Okt, 18:05' },
  { id: 'teh', name: 'Teh', category: 'Minuman', stock: 7, unit: 'botol', minimum: 8, price: null, updated: '29 Okt, 18:05' },
  { id: 'kopi', name: 'Kopi', category: 'Minuman', stock: 16, unit: 'botol', minimum: 8, price: null, updated: '29 Okt, 18:05' },
  { id: 'susu', name: 'Susu', category: 'Minuman', stock: 10, unit: 'pcs', minimum: 8, price: null, updated: '28 Okt, 14:20' },
  { id: 'soda', name: 'Soda', category: 'Minuman', stock: 9, unit: 'kaleng', minimum: 8, price: null, updated: '28 Okt, 14:20' },
  { id: 'isotonik', name: 'Minuman Isotonik', category: 'Minuman', stock: 6, unit: 'botol', minimum: 8, price: null, updated: '27 Okt, 09:30' },
]

export const mockCoinBalances = [
  { id: 'regular', name: 'Koin Reguler', stock: 342, unit: 'koin', note: 'Cuci 30 menit · pengering 45 menit', color: 'blue' },
  { id: 'extra-dry', name: 'Koin Extra Dry', stock: 96, unit: 'koin', note: 'Tambahan waktu pengeringan 20 menit', color: 'cyan' },
]

export const mockCoinMovements = [
  { id: 'KM-0082', type: 'Keluar', coin: 'Koin Reguler', quantity: 2, note: 'Transaksi Self Service', time: 'Hari ini, 09:32', cashier: 'Fera Amelia' },
  { id: 'KM-0081', type: 'Masuk', coin: 'Koin Extra Dry', quantity: 20, note: 'Pengisian stok koin', time: 'Hari ini, 08:10', cashier: 'Fera Amelia' },
  { id: 'KM-0080', type: 'Keluar', coin: 'Koin Reguler', quantity: 1, note: 'Transaksi Self Service', time: 'Hari ini, 07:45', cashier: 'Fera Amelia' },
]

