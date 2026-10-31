BEGIN;

ALTER TABLE outlets
  ADD COLUMN IF NOT EXISTS attendance_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS attendance_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS attendance_checkout_grace_minutes INTEGER NOT NULL DEFAULT 30;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outlets_attendance_coordinates_check'
      AND conrelid = 'outlets'::regclass
  ) THEN
    ALTER TABLE outlets ADD CONSTRAINT outlets_attendance_coordinates_check CHECK (
      (attendance_latitude IS NULL AND attendance_longitude IS NULL)
      OR (attendance_latitude BETWEEN -90 AND 90 AND attendance_longitude BETWEEN -180 AND 180)
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outlets_attendance_grace_check'
      AND conrelid = 'outlets'::regclass
  ) THEN
    ALTER TABLE outlets ADD CONSTRAINT outlets_attendance_grace_check
      CHECK (attendance_checkout_grace_minutes BETWEEN 0 AND 240);
  END IF;
END $$;

ALTER TABLE employee_attendance
  ADD COLUMN IF NOT EXISTS shift_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS checkout_reason VARCHAR(40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_attendance_shift_type_check'
      AND conrelid = 'employee_attendance'::regclass
  ) THEN
    ALTER TABLE employee_attendance ADD CONSTRAINT employee_attendance_shift_type_check
      CHECK (shift_type IS NULL OR shift_type IN ('pagi', 'siang', 'sore', 'malam'));
  END IF;
END $$;

UPDATE employee_attendance a
SET shift_type = s.shift_type
FROM shifts s
WHERE a.shift_id = s.id
  AND a.shift_type IS NULL;

UPDATE employee_attendance a
SET shift_type = (
  SELECT ss.shift_type
  FROM shift_schedules ss
  WHERE ss.is_active
    AND (
      (ss.start_time < ss.end_time
       AND (a.check_in_at AT TIME ZONE 'Asia/Jakarta')::time >= ss.start_time
       AND (a.check_in_at AT TIME ZONE 'Asia/Jakarta')::time < ss.end_time)
      OR
      (ss.start_time >= ss.end_time
       AND ((a.check_in_at AT TIME ZONE 'Asia/Jakarta')::time >= ss.start_time
         OR (a.check_in_at AT TIME ZONE 'Asia/Jakarta')::time < ss.end_time))
    )
  ORDER BY ss.start_time
  LIMIT 1
)
WHERE a.shift_type IS NULL
  AND EXISTS (
    SELECT 1 FROM shift_schedules ss
    WHERE ss.is_active
      AND (
        (ss.start_time < ss.end_time
         AND (a.check_in_at AT TIME ZONE 'Asia/Jakarta')::time >= ss.start_time
         AND (a.check_in_at AT TIME ZONE 'Asia/Jakarta')::time < ss.end_time)
        OR
        (ss.start_time >= ss.end_time
         AND ((a.check_in_at AT TIME ZONE 'Asia/Jakarta')::time >= ss.start_time
           OR (a.check_in_at AT TIME ZONE 'Asia/Jakarta')::time < ss.end_time))
      )
  );

ALTER TABLE employee_attendance
  DROP CONSTRAINT IF EXISTS employee_attendance_user_id_work_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS employee_attendance_user_date_shift_uq
  ON employee_attendance (user_id, work_date, shift_type)
  WHERE shift_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS employee_attendance_outlet_shift_date_idx
  ON employee_attendance (outlet_id, shift_type, work_date DESC);

CREATE TABLE IF NOT EXISTS attendance_events (
  id BIGSERIAL PRIMARY KEY,
  attendance_id INTEGER NOT NULL REFERENCES employee_attendance(id) ON DELETE RESTRICT,
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  event_type VARCHAR(24) NOT NULL CHECK (event_type IN ('check_in', 'check_out', 'checkout_cancelled', 'owner_correction')),
  reason VARCHAR(500),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attendance_time_before TIMESTAMPTZ,
  attendance_time_after TIMESTAMPTZ,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  accuracy_meters NUMERIC(8,2),
  photo_storage_key VARCHAR(80),
  photo_mime VARCHAR(40) CHECK (photo_mime IS NULL OR photo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  photo_size INTEGER CHECK (photo_size IS NULL OR (photo_size > 0 AND photo_size <= 5242880)),
  photo_expires_at TIMESTAMPTZ,
  idempotency_key VARCHAR(100),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR
         (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
  CHECK ((photo_storage_key IS NULL AND photo_mime IS NULL AND photo_size IS NULL AND photo_expires_at IS NULL)
      OR (photo_storage_key IS NOT NULL AND photo_mime IS NOT NULL AND photo_size IS NOT NULL AND photo_expires_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_events_idempotency_uq
  ON attendance_events (actor_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS attendance_events_attendance_occurred_idx
  ON attendance_events (attendance_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS attendance_events_photo_expiry_idx
  ON attendance_events (photo_expires_at)
  WHERE photo_storage_key IS NOT NULL;

COMMIT;
