-- D1 Database Schema with Triggers for Atomic Capacity Control

DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS reservations;

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 200,
  reservation_start TEXT NOT NULL,
  reservation_end TEXT NOT NULL,
  is_accepting INTEGER NOT NULL DEFAULT 1,
  reserved_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_code TEXT NOT NULL UNIQUE,
  access_token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category TEXT NOT NULL,
  participant_count INTEGER NOT NULL,
  discovery_source TEXT NOT NULL,
  discovery_source_other TEXT,
  requested_event TEXT,
  checked_in INTEGER NOT NULL DEFAULT 0,
  checked_in_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Triggers for atomic capacity and state management

-- 1. Check capacity and is_accepting before inserting a new reservation
CREATE TRIGGER check_before_insert
BEFORE INSERT ON reservations
FOR EACH ROW
BEGIN
  -- Capacity check
  SELECT CASE
    WHEN (SELECT reserved_count + NEW.participant_count FROM events WHERE id = 1) > (SELECT capacity FROM events WHERE id = 1)
    THEN RAISE(ABORT, 'CAPACITY_EXCEEDED')
  END;
  -- Status check
  SELECT CASE
    WHEN (SELECT is_accepting FROM events WHERE id = 1) = 0
    THEN RAISE(ABORT, 'RESERVATION_CLOSED')
  END;
END;

-- 2. Increment reserved_count after a successful reservation insert
CREATE TRIGGER increment_reserved_count_after_insert
AFTER INSERT ON reservations
FOR EACH ROW
BEGIN
  UPDATE events SET reserved_count = reserved_count + NEW.participant_count WHERE id = 1;
END;

-- 3. Decrement reserved_count when a reservation is cancelled
CREATE TRIGGER decrement_reserved_count_after_cancel
AFTER UPDATE OF cancelled_at ON reservations
FOR EACH ROW
WHEN OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL
BEGIN
  UPDATE events SET reserved_count = reserved_count - OLD.participant_count WHERE id = 1;
END;

-- 4. Decrement reserved_count when a reservation is physically deleted (if it wasn't already cancelled)
CREATE TRIGGER decrement_reserved_count_after_delete
AFTER DELETE ON reservations
FOR EACH ROW
WHEN OLD.cancelled_at IS NULL
BEGIN
  UPDATE events SET reserved_count = reserved_count - OLD.participant_count WHERE id = 1;
END;

-- Seed initial event data (ID: 1)
INSERT INTO events (id, title, capacity, reservation_start, reservation_end, is_accepting, reserved_count, created_at, updated_at)
VALUES (
  1, 
  'ホームカミングデー 大産大学高校吹奏楽部演奏会', 
  200, 
  '2026-07-01T00:00:00+09:00', 
  '2026-10-23T23:59:59+09:00', 
  1, 
  0, 
  datetime('now'), 
  datetime('now')
);
