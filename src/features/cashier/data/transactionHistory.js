function jakartaDate(offset = 0) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const date = new Date(Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day) + offset))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export const mockDateRange = { today: jakartaDate(), weekStart: jakartaDate(-6) }

export const mockTransactions = [
  { id: `KNO-${mockDateRange.today.replaceAll('-', '')}-024`, date: mockDateRange.today, time: '09:32', customer: 'Dinda Putri', phone: '0812 •••• 3401', category: 'Self Service', items: 'Cuci + Kering · 1 siklus', detail: 'Koin reguler · 1 mesin cuci + 1 pengering', total: 16000, method: 'QRIS', paymentStatus: 'Lunas', cashier: 'Fera Amelia', tendered: 16000, change: 0 },
  { id: `KNO-${mockDateRange.today.replaceAll('-', '')}-023`, date: mockDateRange.today, time: '09:18', customer: 'Budi Santoso', phone: '0813 •••• 7290', category: 'Cuci Kering Setrika', items: 'Cuci Kering Setrika · Reguler · 5 kg', detail: 'Estimasi selesai 2–3 hari', total: 30000, method: 'Tunai', paymentStatus: 'Lunas', cashier: 'Fera Amelia', tendered: 50000, change: 20000 },
  { id: `KNO-${mockDateRange.today.replaceAll('-', '')}-022`, date: mockDateRange.today, time: '08:54', customer: 'Maya Lestari', phone: '0857 •••• 1182', category: 'Drop Off', items: 'Cuci + Kering · 2 muatan', detail: 'Maks. 7 kg per muatan', total: 40000, method: 'Tunai', paymentStatus: 'Belum Bayar', cashier: 'Fera Amelia', tendered: 0, change: 0 },
  { id: `KNO-${mockDateRange.today.replaceAll('-', '')}-021`, date: mockDateRange.today, time: '08:41', customer: 'Andi Wijaya', phone: '0819 •••• 5526', category: 'Produk & Minuman', items: 'Sabun · 2 pcs', detail: 'Penjualan produk', total: 3000, method: 'QRIS', paymentStatus: 'Lunas', cashier: 'Fera Amelia', tendered: 3000, change: 0 },
  { id: `KNO-${jakartaDate(-1).replaceAll('-', '')}-020`, date: jakartaDate(-1), time: '21:16', customer: 'Siti Rahmawati', phone: '0821 •••• 8834', category: 'Setrika Saja', items: 'Setrika Reguler · 4 kg', detail: 'Per kilogram', total: 16000, method: 'Tunai', paymentStatus: 'Lunas', cashier: 'Rina Septiani', tendered: 20000, change: 4000 },
  { id: `KNO-${jakartaDate(-1).replaceAll('-', '')}-019`, date: jakartaDate(-1), time: '18:05', customer: 'Rizky Pratama', phone: '0818 •••• 4102', category: 'Self Service', items: 'Cuci · 1 siklus', detail: 'Koin reguler · mesin cuci', total: 7000, method: 'QRIS', paymentStatus: 'Lunas', cashier: 'Rina Septiani', tendered: 7000, change: 0 },
  { id: `KNO-${jakartaDate(-3).replaceAll('-', '')}-018`, date: jakartaDate(-3), time: '12:48', customer: 'Nadia Safitri', phone: '0878 •••• 5502', category: 'Cuci Kering Setrika', items: 'Cuci Kering Setrika · Express · 4 kg', detail: 'Estimasi selesai 24 jam', total: 32000, method: 'QRIS', paymentStatus: 'Lunas', cashier: 'Fera Amelia', tendered: 32000, change: 0 },
]
