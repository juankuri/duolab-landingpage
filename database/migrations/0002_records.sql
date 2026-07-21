CREATE TABLE patients (
  patient_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE records (
  record_id TEXT PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE RESTRICT
);

CREATE TABLE files (
  file_id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_by TEXT,
  confirmed_at TEXT,
  published_by TEXT,
  published_at TEXT,
  revoked_by TEXT,
  revoked_at TEXT,
  FOREIGN KEY (record_id) REFERENCES records(record_id) ON DELETE RESTRICT,
  CHECK (status IN ('UPLOADED', 'CONFIRMED', 'PUBLISHED', 'REVOKED'))
);