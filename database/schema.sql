-- KINO Laundry POS: PostgreSQL schema.
-- Additions over the supplied diagram: outlets, employee_attendance,
-- transaction payment_status, explicit item foreign keys, and audit-safe stock ledgers.

BEGIN;

CREATE TABLE IF NOT EXISTS outlets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'kasir', 'karyawan')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_outlet_role_idx ON users (outlet_id, role);

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  shift_type VARCHAR(10) NOT NULL CHECK (shift_type IN ('pagi', 'siang', 'sore', 'malam')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  CHECK ((status = 'open' AND ended_at IS NULL) OR (status = 'closed' AND ended_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS shifts_user_status_idx ON shifts (user_id, status);
CREATE INDEX IF NOT EXISTS shifts_outlet_started_idx ON shifts (outlet_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_open_per_user_uq ON shifts (user_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS shift_schedules (
  shift_type VARCHAR(10) PRIMARY KEY CHECK (shift_type IN ('pagi', 'siang', 'sore', 'malam')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO shift_schedules(shift_type,start_time,end_time,timezone) VALUES
  ('pagi','06:00','12:00','Asia/Jakarta'),
  ('siang','13:00','18:00','Asia/Jakarta'),
  ('sore','19:00','00:00','Asia/Jakarta'),
  ('malam','01:00','06:00','Asia/Jakarta')
ON CONFLICT (shift_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS employee_attendance (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER REFERENCES outlets(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_at TIMESTAMPTZ,
  status VARCHAR(12) NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir', 'izin', 'sakit', 'alpha')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, work_date),
  CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);
CREATE INDEX IF NOT EXISTS attendance_outlet_date_idx ON employee_attendance (outlet_id, work_date DESC);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (LOWER(name));
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  pricing_unit VARCHAR(20) NOT NULL,
  base_price NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS service_prices (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price_type VARCHAR(12) NOT NULL CHECK (price_type IN ('normal', 'malam')),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (service_id, price_type)
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  minimum_stock NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  unit VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id),
  transaction_number VARCHAR(30) NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('self_service', 'drop_off', 'laundry', 'product')),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  notes TEXT,
  weight_kg NUMERIC(6,2) CHECK (weight_kg IS NULL OR weight_kg > 0),
  washer_machine_count INTEGER CHECK (washer_machine_count IS NULL OR washer_machine_count >= 0),
  dryer_machine_count INTEGER CHECK (dryer_machine_count IS NULL OR dryer_machine_count >= 0),
  payment_method VARCHAR(10) CHECK (payment_method IN ('tunai', 'qris')),
  cash_received NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cash_received >= 0),
  change_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  idempotency_key VARCHAR(100),
  request_hash CHAR(64),
  payment_status VARCHAR(15) NOT NULL DEFAULT 'belum_bayar' CHECK (payment_status IN ('belum_bayar', 'lunas')),
  status VARCHAR(15) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'dibatalkan')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactions_outlet_created_idx ON transactions (outlet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_shift_idx ON transactions (shift_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_payment_status_idx ON transactions (payment_status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_idempotency_key_uq ON transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS transaction_items (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('service', 'product')),
  service_id INTEGER REFERENCES services(id),
  product_id INTEGER REFERENCES products(id),
  description VARCHAR(150) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  CHECK ((item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL) OR
         (item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL))
);
CREATE INDEX IF NOT EXISTS transaction_items_transaction_idx ON transaction_items (transaction_id);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('tunai', 'qris')),
  confirmation_method VARCHAR(20) CHECK (confirmation_method IN ('manual', 'provider')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_shift_paid_idx ON payments (shift_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS laundry_orders (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  weight NUMERIC(6,2) CHECK (weight >= 0),
  service_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'diproses', 'selesai', 'sudah_diambil', 'dibatalkan')),
  estimated_completion TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS laundry_orders_status_created_idx ON laundry_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS laundry_order_status_history (
  id SERIAL PRIMARY KEY,
  laundry_order_id INTEGER NOT NULL REFERENCES laundry_orders(id) ON DELETE RESTRICT,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL CHECK (new_status IN ('menunggu', 'diproses', 'selesai', 'sudah_diambil', 'dibatalkan')),
  changed_by INTEGER NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS laundry_order_status_history_order_idx ON laundry_order_status_history (laundry_order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  laundry_order_id INTEGER NOT NULL UNIQUE REFERENCES laundry_orders(id) ON DELETE RESTRICT,
  delivery_type VARCHAR(20) NOT NULL CHECK (delivery_type IN ('tanpa_pengiriman', 'jemput', 'antar', 'antar_jemput')),
  address TEXT,
  one_way_distance NUMERIC(6,2) CHECK (one_way_distance >= 0),
  round_trip_distance NUMERIC(6,2) CHECK (round_trip_distance >= 0),
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'dijemput', 'diterima_laundry', 'siap_diantar', 'dalam_pengantaran', 'terkirim')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coin_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE,
  description TEXT,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS coin_movements (
  id SERIAL PRIMARY KEY,
  coin_type_id INTEGER NOT NULL REFERENCES coin_types(id),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE RESTRICT,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  movement_type VARCHAR(15) NOT NULL CHECK (movement_type IN ('masuk', 'keluar', 'penyesuaian')),
  direction VARCHAR(10) CHECK (direction IN ('masuk', 'keluar')),
  user_id INTEGER REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coin_movements_shift_idx ON coin_movements (shift_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS coin_movements_transaction_type_uq
  ON coin_movements (transaction_id, coin_type_id)
  WHERE transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id),
  expense_number VARCHAR(40) NOT NULL UNIQUE,
  category VARCHAR(60) NOT NULL CHECK (category IN (
    'Pembelian sabun',
    'Pembelian pewangi',
    'Pembelian gas',
    'Perawatan mesin',
    'Pembelian stok lainnya',
    'Pengeluaran operasional lainnya'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description VARCHAR(500) NOT NULL,
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('tunai', 'qris')),
  funding_source VARCHAR(20) NOT NULL CHECK (funding_source IN ('laci_kas', 'rekening_usaha')),
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  receipt_storage_key VARCHAR(80) NOT NULL,
  receipt_mime VARCHAR(40) NOT NULL CHECK (receipt_mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  receipt_size INTEGER NOT NULL CHECK (receipt_size > 0 AND receipt_size <= 5242880),
  idempotency_key VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((payment_method = 'tunai' AND funding_source = 'laci_kas') OR
         (payment_method = 'qris' AND funding_source = 'rekening_usaha'))
);
CREATE UNIQUE INDEX IF NOT EXISTS expenses_outlet_idempotency_uq
  ON expenses (outlet_id, idempotency_key);
CREATE INDEX IF NOT EXISTS expenses_outlet_created_idx
  ON expenses (outlet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS expenses_shift_created_idx
  ON expenses (shift_id, created_at DESC);

CREATE TABLE IF NOT EXISTS expense_audit (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  change_reason VARCHAR(500) NOT NULL,
  old_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expense_audit_expense_created_idx
  ON expense_audit (expense_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  movement_type VARCHAR(15) NOT NULL CHECK (movement_type IN ('masuk', 'keluar', 'penyesuaian')),
  direction VARCHAR(10) CHECK (direction IN ('masuk', 'keluar')),
  user_id INTEGER REFERENCES users(id),
  reason TEXT,
  reference_id INTEGER,
  expense_id INTEGER REFERENCES expenses(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(100),
  request_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON inventory_movements (product_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_idempotency_uq
  ON inventory_movements (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_expense_idx
  ON inventory_movements (expense_id)
  WHERE expense_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_jobs (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('transaction', 'order', 'report')),
  source_id INTEGER NOT NULL,
  sync_status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'success', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO outlets (name) SELECT 'KINO Laundry' WHERE NOT EXISTS (SELECT 1 FROM outlets);
INSERT INTO coin_types (name, description) VALUES
  ('Koin Reguler', 'Cuci 30 menit atau pengering 45 menit'),
  ('Koin Extra Dry', 'Tambahan waktu pengeringan 20 menit')
ON CONFLICT (name) DO NOTHING;

COMMIT;
