import { ParticipantStatus, TimeRecordType, EliminationCode, MotricityStatus, ClinicalStatus } from '@equuscronos/shared';

// TypeScript Interfaces for Local SQLite DB
export interface LocalCompetitionEntry {
  id: string; // UUID
  tenant_id: string;
  competition_id: string;
  rider_id: string;
  rider_name: string; // Cached for offline UX
  horse_id: string;
  horse_name: string; // Cached for offline UX
  bib_number: number;
  status: ParticipantStatus;
  current_stage_id: string;
  ballast_weight: number;
  created_at: string;
  updated_at: string;
}

export interface LocalTimingRecord {
  id: string; // UUID
  tenant_id: string;
  entry_id: string;
  stage_id: string;
  record_type: TimeRecordType;
  recorded_at: string; // ISO String
  is_approved: number; // 0 or 1
  elimination_type?: EliminationCode | null;
  elimination_reason?: string | null;
  is_void: number; // 0 or 1
  void_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalVetInspection {
  id: string; // UUID
  tenant_id: string;
  timing_record_id: string;
  heart_rate: number;
  temperature?: number | null;
  motricity: MotricityStatus;
  metabolic: ClinicalStatus;
  attempt_number: number; // 1 or 2
  is_recheck_required: number; // 0 or 1
  next_check_time?: string | null; // ISO String
  notes?: string | null;
  created_at: string;
}

export interface SyncQueueItem {
  id: number;
  action_type: 'CREATE_TIMING' | 'CREATE_VET_INSPECTION' | 'UPDATE_ENTRY_STATUS' | 'UPDATE_TIMING' | 'VOID_TIMING';
  table_name: 'timing_records' | 'vet_inspections' | 'competition_entries';
  payload: string; // JSON string
  created_at: string;
  attempts: number;
  error_message?: string | null;
}

// SQL schema scripts
export const SQL_CREATE_TABLES = [
  // 1. Competition Entries
  `CREATE TABLE IF NOT EXISTS competition_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    competition_id TEXT NOT NULL,
    rider_id TEXT NOT NULL,
    rider_name TEXT NOT NULL,
    horse_id TEXT NOT NULL,
    horse_name TEXT NOT NULL,
    bib_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    current_stage_id TEXT NOT NULL,
    ballast_weight REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  // 2. Timing Records
  `CREATE TABLE IF NOT EXISTS timing_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    stage_id TEXT NOT NULL,
    record_type TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    is_approved INTEGER DEFAULT 1,
    elimination_type TEXT,
    elimination_reason TEXT,
    is_void INTEGER DEFAULT 0,
    void_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(entry_id) REFERENCES competition_entries(id)
  );`,

  // 3. Vet Inspections
  `CREATE TABLE IF NOT EXISTS vet_inspections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    timing_record_id TEXT NOT NULL,
    heart_rate INTEGER NOT NULL,
    temperature REAL,
    motricity TEXT NOT NULL,
    metabolic TEXT NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    is_recheck_required INTEGER DEFAULT 0,
    next_check_time TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(timing_record_id) REFERENCES timing_records(id)
  );`,

  // 4. Sync Queue
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    table_name TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    error_message TEXT
  );`
];
