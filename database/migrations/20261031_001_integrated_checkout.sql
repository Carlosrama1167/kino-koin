BEGIN;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6,2) CHECK (weight_kg IS NULL OR weight_kg > 0),
  ADD COLUMN IF NOT EXISTS washer_machine_count INTEGER CHECK (washer_machine_count IS NULL OR washer_machine_count >= 0),
  ADD COLUMN IF NOT EXISTS dryer_machine_count INTEGER CHECK (dryer_machine_count IS NULL OR dryer_machine_count >= 0),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) CHECK (payment_method IN ('tunai', 'qris')),
  ADD COLUMN IF NOT EXISTS cash_received NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cash_received >= 0),
  ADD COLUMN IF NOT EXISTS change_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS request_hash CHAR(64);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS confirmation_method VARCHAR(20) CHECK (confirmation_method IN ('manual', 'provider'));

ALTER TABLE coin_movements
  ADD COLUMN IF NOT EXISTS direction VARCHAR(10) CHECK (direction IN ('masuk', 'keluar')),
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS direction VARCHAR(10) CHECK (direction IN ('masuk', 'keluar')),
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_shift_type_check;
ALTER TABLE shifts ADD CONSTRAINT shifts_shift_type_check
  CHECK (shift_type IN ('pagi', 'siang', 'sore', 'malam'));

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

CREATE UNIQUE INDEX IF NOT EXISTS transactions_idempotency_key_uq
  ON transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coin_movements_transaction_type_uq
  ON coin_movements (transaction_id, coin_type_id)
  WHERE transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS laundry_order_status_history (
  id SERIAL PRIMARY KEY,
  laundry_order_id INTEGER NOT NULL REFERENCES laundry_orders(id) ON DELETE RESTRICT,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL CHECK (new_status IN ('menunggu', 'diproses', 'selesai', 'sudah_diambil', 'dibatalkan')),
  changed_by INTEGER NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS laundry_order_status_history_order_idx
  ON laundry_order_status_history (laundry_order_id, created_at DESC);

COMMIT;
