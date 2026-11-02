BEGIN;

INSERT INTO services(code,name,category,pricing_unit,base_price)
VALUES ('DROP-KERING','Kering saja','Drop Off','7kg',12000)
ON CONFLICT(code) DO NOTHING;

CREATE TABLE IF NOT EXISTS membership_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  card_color VARCHAR(20) NOT NULL,
  stamp_slots INTEGER NOT NULL CHECK (stamp_slots > 0),
  requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO membership_types(code,name,card_color,stamp_slots,requires_verification) VALUES
  ('REGULAR','Member Reguler','green',12,FALSE),
  ('STUDENT','Member Pelajar/Mahasiswa','yellow',6,TRUE)
ON CONFLICT(code) DO NOTHING;

CREATE TABLE IF NOT EXISTS membership_members (
  id SERIAL PRIMARY KEY,
  member_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE RESTRICT,
  membership_type_id INTEGER NOT NULL REFERENCES membership_types(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'aktif', 'nonaktif')),
  verification_status VARCHAR(20) NOT NULL CHECK (verification_status IN ('not_required', 'pending', 'verified')),
  verified_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(100) UNIQUE,
  request_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((verification_status = 'verified' AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
      OR verification_status <> 'verified'),
  CHECK (verification_status <> 'pending' OR status = 'pending')
);
CREATE INDEX IF NOT EXISTS membership_members_type_status_idx
  ON membership_members (membership_type_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS membership_cards (
  id SERIAL PRIMARY KEY,
  card_number VARCHAR(50) NOT NULL UNIQUE,
  member_id INTEGER NOT NULL REFERENCES membership_members(id) ON DELETE RESTRICT,
  stamp_slots INTEGER NOT NULL CHECK (stamp_slots > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'diserahkan')),
  issued_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  handed_over_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  handed_over_at TIMESTAMPTZ,
  CHECK ((status = 'aktif' AND handed_over_by IS NULL AND handed_over_at IS NULL)
      OR (status = 'diserahkan' AND handed_over_by IS NOT NULL AND handed_over_at IS NOT NULL)),
  UNIQUE (id, member_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS membership_cards_one_active_per_member_uq
  ON membership_cards (member_id) WHERE status = 'aktif';
CREATE INDEX IF NOT EXISTS membership_cards_member_issued_idx
  ON membership_cards (member_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS membership_stamps (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES membership_members(id) ON DELETE RESTRICT,
  card_id INTEGER NOT NULL,
  transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  operating_date DATE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, operating_date),
  FOREIGN KEY (card_id, member_id) REFERENCES membership_cards(id, member_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS membership_stamps_card_idx
  ON membership_stamps (card_id, created_at, id);

CREATE SEQUENCE IF NOT EXISTS membership_coupon_number_seq;
CREATE TABLE IF NOT EXISTS membership_raffle_coupons (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(40) NOT NULL UNIQUE,
  member_id INTEGER NOT NULL REFERENCES membership_members(id) ON DELETE RESTRICT,
  card_id INTEGER NOT NULL UNIQUE,
  issued_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (card_id, member_id) REFERENCES membership_cards(id, member_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS membership_raffle_coupons_issued_idx
  ON membership_raffle_coupons (issued_at DESC, id);

CREATE TABLE IF NOT EXISTS membership_card_redemptions (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL UNIQUE REFERENCES membership_cards(id) ON DELETE RESTRICT,
  coupon_id INTEGER NOT NULL UNIQUE REFERENCES membership_raffle_coupons(id) ON DELETE RESTRICT,
  new_card_id INTEGER NOT NULL UNIQUE REFERENCES membership_cards(id) ON DELETE RESTRICT,
  processed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(100) NOT NULL UNIQUE,
  request_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
