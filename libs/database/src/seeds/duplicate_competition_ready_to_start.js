const { Client } = require("pg");
const { crypto, randomUUID } = require("crypto");
const path = require("path");
const fs = require("fs");

const SOURCE_COMPETITION_ID = "9c9f5da0-8f52-4441-833f-9aa9e8664e7b";

const dbConfig = {
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "equus_secure_pass_2026",
  database: "equuscronos",
};

// Try to load .env from apps/api
try {
  const envPath = path.join(__dirname, "../../../apps/api/.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach((line) => {
      const parts = line.split("=");
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        if (key === "DB_HOST") dbConfig.host = value;
        if (key === "DB_PORT") dbConfig.port = parseInt(value, 10);
        if (key === "DB_USER") dbConfig.user = value;
        if (key === "DB_PASSWORD") dbConfig.password = value;
        if (key === "DB_NAME") dbConfig.database = value;
      }
    });
  }
} catch (err) {
  console.log("Using default DB config:", err.message);
}

async function duplicateCompetition() {
  const client = new Client(dbConfig);
  await client.connect();
  console.log("Connected to database successfully.");

  try {
    // Clean up previous test copies if exist
    await client.query(`DELETE FROM competitions WHERE name LIKE '%(Pronta para Iniciar)%'`);

    // 1. Fetch Source Competition
    const compRes = await client.query(
      `SELECT * FROM competitions WHERE id = $1`,
      [SOURCE_COMPETITION_ID],
    );
    if (compRes.rows.length === 0) {
      throw new Error(
        `Source competition ${SOURCE_COMPETITION_ID} not found in database.`,
      );
    }
    const sourceComp = compRes.rows[0];

    // Today's date YYYY-MM-DD
    const todayStr = new Date().toISOString().substring(0, 10);
    const newCompId = randomUUID();
    const newCompName = `${sourceComp.name} (Pronta para Iniciar)`;

    console.log(
      `Duplicating competition: "${sourceComp.name}" -> "${newCompName}"`,
    );
    console.log(`New Competition ID: ${newCompId}`);
    console.log(`Date: ${todayStr} | Start Time: 12:30:00 | Status: ACTIVE`);

    // Insert New Competition
    await client.query(
      `INSERT INTO competitions (
        id, tenant_id, competition_type_id, name, competition_date, start_time, location, is_federated, enable_rfid_chips, vet_inspection_mode, max_heart_rate, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        newCompId,
        sourceComp.tenant_id,
        sourceComp.competition_type_id,
        newCompName,
        todayStr,
        "12:30:00",
        sourceComp.location || "San José",
        sourceComp.is_federated ?? true,
        sourceComp.enable_rfid_chips ?? false,
        sourceComp.vet_inspection_mode || "SIMPLE",
        sourceComp.max_heart_rate ?? 65,
        "PLANNED",
      ],
    );

    // 2. Fetch Source Stages
    const stagesRes = await client.query(
      `SELECT * FROM stages WHERE competition_id = $1 ORDER BY stage_number ASC`,
      [SOURCE_COMPETITION_ID],
    );

    const stageIdMapping = {}; // oldStageId -> newStageId
    let firstNewStageId = null;

    for (const stg of stagesRes.rows) {
      const newStageId = randomUUID();
      stageIdMapping[stg.id] = newStageId;
      if (!firstNewStageId && stg.stage_number === 1) {
        firstNewStageId = newStageId;
      }

      await client.query(
        `INSERT INTO stages (
          id, tenant_id, competition_id, stage_number, distance_km, neutralization_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newStageId,
          stg.tenant_id,
          newCompId,
          stg.stage_number,
          stg.distance_km,
          stg.neutralization_minutes,
        ],
      );
    }
    console.log(`Created ${stagesRes.rows.length} stages for new competition.`);

    // 3. Fetch Source Entries
    const entriesRes = await client.query(
      `SELECT * FROM competition_entries WHERE competition_id = $1 ORDER BY bib_number ASC`,
      [SOURCE_COMPETITION_ID],
    );

    let insertedEntriesCount = 0;
    for (const entry of entriesRes.rows) {
      const newEntryId = randomUUID();
      const targetStageId = firstNewStageId || stageIdMapping[entry.current_stage_id] || null;

      await client.query(
        `INSERT INTO competition_entries (
          id, tenant_id, competition_id, rider_id, horse_id, represented_tenant_id, bib_number, status, ballast_weight, seal_number, current_stage_id, weigh_in_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
        [
          newEntryId,
          entry.tenant_id,
          newCompId,
          entry.rider_id,
          entry.horse_id,
          entry.represented_tenant_id,
          entry.bib_number,
          "IN_RACE",
          entry.ballast_weight,
          entry.seal_number,
          targetStageId,
        ],
      );

      // Copy initial weight control record if present
      await client.query(
        `INSERT INTO weight_controls (
          entry_id, stage_id, weight_recorded, control_type, recorded_by
        ) VALUES ($1, NULL, $2, 'INITIAL', 'e1000000-0000-0000-0000-000000000003')`,
        [newEntryId, entry.ballast_weight || 85.00],
      );

      insertedEntriesCount++;
    }

    console.log(
      `Successfully copied ${insertedEntriesCount} competitors (binomios) into new competition!`,
    );

    console.log("\n=======================================================");
    console.log("✅ NUEVA COMPETENCIA DUPLICADA Y LISTA PARA INICIAR:");
    console.log(`- Nombre: ${newCompName}`);
    console.log(`- ID: ${newCompId}`);
    console.log(`- Fecha: ${todayStr}`);
    console.log(`- Hora Largada: 12:30:00`);
    console.log(`- Estado: ACTIVE (En Carrera / Pronta para Iniciar)`);
    console.log(`- Competidores: ${insertedEntriesCount} binomios`);
    console.log("=======================================================\n");
  } catch (err) {
    console.error("Error duplicating competition:", err);
  } finally {
    await client.end();
  }
}

duplicateCompetition();
