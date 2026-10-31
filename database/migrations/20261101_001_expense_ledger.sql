BEGIN;

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

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS expense_id INTEGER REFERENCES expenses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS request_hash CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_idempotency_uq
  ON inventory_movements (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_expense_idx
  ON inventory_movements (expense_id)
  WHERE expense_id IS NOT NULL;

COMMIT;
