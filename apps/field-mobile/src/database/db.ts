import * as SQLite from 'expo-sqlite';
import { SQL_CREATE_TABLES } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Gets the active SQLite database instance, opening it if necessary.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('equuscronos_field.db');
  }
  return dbInstance;
}

/**
 * Initializes the database schema, creating tables and seeding default records.
 */
export async function initDatabase(): Promise<void> {
  try {
    const db = await getDatabase();
    
    // Enable Foreign Key support in SQLite
    await db.execAsync('PRAGMA foreign_keys = ON;');
    
    // Execute creation scripts
    for (const sql of SQL_CREATE_TABLES) {
      await db.execAsync(sql);
    }
    
    console.log('[SQLite] Local database initialized successfully.');

    // Seed mock entries if empty
    const countResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM competition_entries;'
    );
    
    if (countResult && countResult.count === 0) {
      console.log('[SQLite] No local entries found. Seeding mock FEU competition entries...');
      await seedLocalDatabase(db);
    }
  } catch (error) {
    console.error('[SQLite] Error initializing database:', error);
    throw error;
  }
}

/**
 * Seeds local database with high-quality mock data conforming to FEU rules.
 */
async function seedLocalDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  const tenantId = '77777777-7777-7777-7777-777777777777';
  const competitionId = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0';
  const stageId1 = 's1111111-1111-1111-1111-111111111111'; // Stage 1 (30km)

  // Seed competition entries conforming to FEU Raid / Endurance rules
  const mockEntries = [
    {
      id: 'entry-01',
      tenant_id: tenantId,
      competition_id: competitionId,
      rider_id: 'rider-01',
      rider_name: 'Juan Silva (FEU-8492)',
      horse_id: 'horse-01',
      horse_name: 'Altanero (Chip-8931)',
      bib_number: 14,
      status: 'IN_RACE',
      current_stage_id: stageId1,
      ballast_weight: 75.50
    },
    {
      id: 'entry-02',
      tenant_id: tenantId,
      competition_id: competitionId,
      rider_id: 'rider-02',
      rider_name: 'Mateo González (FEU-9104)',
      horse_id: 'horse-02',
      horse_name: 'Centella (Chip-0382)',
      bib_number: 8,
      status: 'VET_CHECK',
      current_stage_id: stageId1,
      ballast_weight: 70.00
    },
    {
      id: 'entry-03',
      tenant_id: tenantId,
      competition_id: competitionId,
      rider_id: 'rider-03',
      rider_name: 'Sofía Larrañaga (FEU-7651)',
      horse_id: 'horse-03',
      horse_name: 'Pampera (Chip-1492)',
      bib_number: 3,
      status: 'RESTING',
      current_stage_id: stageId1,
      ballast_weight: 76.20
    },
    {
      id: 'entry-04',
      tenant_id: tenantId,
      competition_id: competitionId,
      rider_id: 'rider-04',
      rider_name: 'Carlos Bentancur (FEU-8302)',
      horse_id: 'horse-04',
      horse_name: 'Negro Lindo (Chip-7711)',
      bib_number: 21,
      status: 'IN_RACE',
      current_stage_id: stageId1,
      ballast_weight: 81.00
    },
    {
      id: 'entry-05',
      tenant_id: tenantId,
      competition_id: competitionId,
      rider_id: 'rider-05',
      rider_name: 'Lucía Olivera (FEU-6218)',
      horse_id: 'horse-05',
      horse_name: 'Libertad (Chip-9932)',
      bib_number: 45,
      status: 'FINISHED',
      current_stage_id: stageId1,
      ballast_weight: 74.80
    }
  ];

  const now = new Date().toISOString();

  // Insert mock entries
  for (const entry of mockEntries) {
    await db.runAsync(
      `INSERT INTO competition_entries (
        id, tenant_id, competition_id, rider_id, rider_name, horse_id, horse_name, 
        bib_number, status, current_stage_id, ballast_weight, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        entry.id,
        entry.tenant_id,
        entry.competition_id,
        entry.rider_id,
        entry.rider_name,
        entry.horse_id,
        entry.horse_name,
        entry.bib_number,
        entry.status,
        entry.current_stage_id,
        entry.ballast_weight,
        now,
        now
      ]
    );
  }

  // Seed initial timing record and vet inspection for entry-03 (currently RESTING)
  // Juan Silva had a start time
  await db.runAsync(
    `INSERT INTO timing_records (
      id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'time-start-01',
      tenantId,
      'entry-01',
      stageId1,
      'START',
      new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      1,
      now,
      now
    ]
  );

  // Mateo González has a START and ARRIVAL, and is in VET_CHECK
  const mateoArrivalTime = new Date(Date.now() - 600000).toISOString(); // 10 mins ago
  await db.runAsync(
    `INSERT INTO timing_records (
      id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'time-start-02',
      tenantId,
      'entry-02',
      stageId1,
      'START',
      new Date(Date.now() - 3600000 * 1.5).toISOString(), // 1.5 hours ago
      1,
      now,
      now
    ]
  );
  await db.runAsync(
    `INSERT INTO timing_records (
      id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'time-arrival-02',
      tenantId,
      'entry-02',
      stageId1,
      'ARRIVAL',
      mateoArrivalTime,
      1,
      now,
      now
    ]
  );

  // Sofía Larrañaga has a START, ARRIVAL, VET_IN and VET_OUT, currently resting
  await db.runAsync(
    `INSERT INTO timing_records (
      id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'time-start-03',
      tenantId,
      'entry-03',
      stageId1,
      'START',
      new Date(Date.now() - 3600000 * 2).toISOString(),
      1,
      now,
      now
    ]
  );
  await db.runAsync(
    `INSERT INTO timing_records (
      id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'time-arrival-03',
      tenantId,
      'entry-03',
      stageId1,
      'ARRIVAL',
      new Date(Date.now() - 3600000 * 0.7).toISOString(),
      1,
      now,
      now
    ]
  );
  await db.runAsync(
    `INSERT INTO timing_records (
      id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'time-vetin-03',
      tenantId,
      'entry-03',
      stageId1,
      'VET_IN',
      new Date(Date.now() - 3600000 * 0.6).toISOString(),
      1,
      now,
      now
    ]
  );
  await db.runAsync(
    `INSERT INTO vet_inspections (
      id, tenant_id, timing_record_id, heart_rate, temperature, motricity, metabolic, attempt_number, is_recheck_required, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'vet-insp-03',
      tenantId,
      'time-vetin-03',
      52, // Healthy! 52 bpm is under standard limit (e.g. 56 or 60 bpm)
      38.2,
      'APTO',
      'NORMAL',
      1,
      0,
      now
    ]
  );

  console.log('[SQLite] Seeding completed.');
}
