BEGIN;

ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6,2) CHECK (weight_kg IS NULL OR weight_kg > 0),
  ADD COLUMN IF NOT EXISTS washer_machine_count INTEGER CHECK (washer_machine_count IS NULL OR washer_machine_count >= 0),
  ADD COLUMN IF NOT EXISTS dryer_machine_count INTEGER CHECK (dryer_machine_count IS NULL OR dryer_machine_count >= 0);

ALTER TABLE transactions
  ALTER COLUMN weight_kg TYPE NUMERIC(8,2);

COMMIT;
