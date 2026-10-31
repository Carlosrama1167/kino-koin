function jakartaDate(offset = 0) {
  const part = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(({ type, value }) => [type, value]))
  const date = new Date(Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day) + offset))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export const shiftReportDates = { today: jakartaDate(), yesterday: jakartaDate(-1), twoDaysAgo: jakartaDate(-2) }

// Rekap ini hanya contoh visual; angka aktual berasal dari catatan pembayaran dan pergerakan koin backend.
export const mockShiftReports = [
  { id: 'SH-0248', date: shiftReportDates.today, shift: 'Pagi', cashier: 'Fera Amelia', start: '06:12', end: null, transactions: 24, cash: 285000, qris: 200000, regularCoins: 16, extraDryCoins: 3, unpaidOrders: 2, unpaidValue: 40000, status: 'Berjalan' },
  { id: 'SH-0247', date: shiftReportDates.yesterday, shift: 'Malam', cashier: 'Rina Septiani', start: '22:34', end: '06:08', transactions: 29, cash: 680000, qris: 1100000, regularCoins: 38, extraDryCoins: 7, unpaidOrders: 1, unpaidValue: 20000, status: 'Ditutup' },
  { id: 'SH-0246', date: shiftReportDates.yesterday, shift: 'Siang', cashier: 'Budi Santoso', start: '14:19', end: '22:18', transactions: 38, cash: 920000, qris: 1450000, regularCoins: 24, extraDryCoins: 6, unpaidOrders: 0, unpaidValue: 0, status: 'Ditutup' },
  { id: 'SH-0245', date: shiftReportDates.yesterday, shift: 'Pagi', cashier: 'Fera Amelia', start: '06:07', end: '14:03', transactions: 46, cash: 1028000, qris: 1290000, regularCoins: 32, extraDryCoins: 4, unpaidOrders: 2, unpaidValue: 64000, status: 'Ditutup' },
  { id: 'SH-0242', date: shiftReportDates.twoDaysAgo, shift: 'Malam', cashier: 'Budi Santoso', start: '22:41', end: '06:02', transactions: 31, cash: 745000, qris: 890000, regularCoins: 29, extraDryCoins: 5, unpaidOrders: 1, unpaidValue: 18000, status: 'Ditutup' },
]
