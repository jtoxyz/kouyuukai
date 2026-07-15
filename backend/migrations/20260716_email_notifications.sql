CREATE TABLE IF NOT EXISTS email_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sender_name TEXT NOT NULL DEFAULT '大阪産業大学校友会',
  sender_email TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '2026-10-31',
  event_location TEXT NOT NULL DEFAULT '大阪産業大学 本館1階 多目的ホール',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO email_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('confirmation', 'scheduled')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  days_before INTEGER,
  send_time TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_confirmation_unique
ON email_templates(template_type)
WHERE template_type = 'confirmation';

INSERT OR IGNORE INTO email_templates
  (id, name, template_type, subject, body, days_before, send_time, enabled)
VALUES
  (1, '予約完了メール', 'confirmation', '', '', NULL, NULL, 0),
  (2, '開催2日前リマインド', 'scheduled', '', '', 2, '09:00', 0),
  (3, '開催1日前リマインド', 'scheduled', '', '', 1, '09:00', 0);

CREATE TABLE IF NOT EXISTS email_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  reservation_id INTEGER NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  UNIQUE(template_id, reservation_id),
  FOREIGN KEY (template_id) REFERENCES email_templates(id),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE INDEX IF NOT EXISTS email_deliveries_status_idx
ON email_deliveries(template_id, status);
