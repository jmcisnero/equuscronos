import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";

describe("Vet Gate Flow (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let vetToken: string;
  let timekeeperToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    const jwtService = app.get(JwtService);

    // Generate tokens dynamically
    adminToken = jwtService.sign({
      sub: "e1000000-0000-0000-0000-000000000003",
      email: "admin@equuscronos.com",
      role: "ADMIN",
      tenantId: "a1000000-0000-0000-0000-000000000001",
    });

    vetToken = jwtService.sign({
      sub: "e1000000-0000-0000-0000-000000000002",
      email: "vet@melo.uy",
      role: "VET",
      tenantId: "a1000000-0000-0000-0000-000000000001",
    });

    timekeeperToken = jwtService.sign({
      sub: "e1000000-0000-0000-0000-000000000001",
      email: "juez@melo.uy",
      role: "TIMEKEEPER",
      tenantId: "a1000000-0000-0000-0000-000000000001",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("FEU Recovery Time limit (20-minute rule)", () => {
    let competitionId: string;
    let stage1Id: string;
    let stage2Id: string;
    let entryId: string;
    let horseId: string;
    let riderId: string;
    let ownerId: string;
    const bibNumber = 901;

    beforeEach(async () => {
      // Clean up potentially leaked records from previous failed runs
      await dataSource.query(
        `DELETE FROM competition_entries WHERE bib_number = ${bibNumber};`,
      );
      await dataSource.query(
        `DELETE FROM horses WHERE feu_id = 'FEU-H-${bibNumber}';`,
      );
      await dataSource.query(
        `DELETE FROM riders WHERE feu_id = 'FEU-R-${bibNumber}';`,
      );

      // 1. Create a clean competition, stages, rider, horse, and entry for testing
      const tenantId = "a1000000-0000-0000-0000-000000000001";
      competitionId = randomUUID();
      stage1Id = randomUUID();
      stage2Id = randomUUID();
      horseId = randomUUID();
      riderId = randomUUID();
      entryId = randomUUID();
      ownerId = randomUUID();

      await dataSource.query(`
        INSERT INTO competitions (id, tenant_id, competition_type_id, name, status, location, competition_date, enable_rfid_chips)
        VALUES ('${competitionId}', '${tenantId}', 'c1000000-0000-0000-0000-000000000001', 'Test E2E Competition', 'ACTIVE', 'Melo', '2026-06-10', TRUE);
      `);

      await dataSource.query(`
        INSERT INTO stages (id, tenant_id, competition_id, stage_number, distance_km, neutralization_minutes)
        VALUES 
          ('${stage1Id}', '${tenantId}', '${competitionId}', 1, 30.00, 60),
          ('${stage2Id}', '${tenantId}', '${competitionId}', 2, 20.00, 0);
      `);

      await dataSource.query(`
        INSERT INTO owners (id, name, type) VALUES ('${ownerId}', 'Owner E2E', 'PERSON');
      `);

      await dataSource.query(`
        INSERT INTO horses (id, name, feu_id, chip_id, is_feu_active, owner_id)
        VALUES ('${horseId}', 'Test E2E Horse', 'FEU-H-${bibNumber}', 'CHIP-${bibNumber}', TRUE, '${ownerId}');
      `);

      await dataSource.query(`
        INSERT INTO riders (id, name, national_id, feu_id, is_feu_active)
        VALUES ('${riderId}', 'Test E2E Rider', '9.999.999-9', 'FEU-R-${bibNumber}', TRUE);
      `);

      await dataSource.query(`
        INSERT INTO competition_entries (id, tenant_id, competition_id, rider_id, horse_id, bib_number, status, current_stage_id)
        VALUES ('${entryId}', '${tenantId}', '${competitionId}', '${riderId}', '${horseId}', ${bibNumber}, 'IN_RACE', '${stage1Id}');
      `);
    });

    afterEach(async () => {
      // Cleanup testing data in correct order
      await dataSource.query(
        `DELETE FROM vet_inspections WHERE competence_id = '${competitionId}';`,
      );
      await dataSource.query(
        `DELETE FROM timing_records WHERE entry_id = '${entryId}';`,
      );
      await dataSource.query(
        `DELETE FROM competition_entries WHERE competition_id = '${competitionId}';`,
      );
      await dataSource.query(
        `DELETE FROM stages WHERE competition_id = '${competitionId}';`,
      );
      await dataSource.query(
        `DELETE FROM competitions WHERE id = '${competitionId}';`,
      );
      await dataSource.query(`DELETE FROM horses WHERE id = '${horseId}';`);
      await dataSource.query(`DELETE FROM riders WHERE id = '${riderId}';`);
      await dataSource.query(`DELETE FROM owners WHERE id = '${ownerId}';`);
    });

    it("should automatically disqualify (DQ) entry with EliminationCode.TIME if VET_IN presentation takes more than 20 minutes from ARRIVAL", async () => {
      // 1. Record START time (inserted directly to database as the API prohibits manual START registrations)
      const startRecordId = randomUUID();
      await dataSource.query(`
        INSERT INTO timing_records (id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved)
        VALUES ('${startRecordId}', 'a1000000-0000-0000-0000-000000000001', '${entryId}', '${stage1Id}', 'START', '2026-06-10 08:00:00-03', TRUE);
      `);

      // 2. Record ARRIVAL time
      const arrivalRes = await request(app.getHttpServer())
        .post("/timing")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId,
          stageId: stage1Id,
          bibNumber,
          recordType: "ARRIVAL",
          recordedAt: new Date("2026-06-10T09:30:00Z").toISOString(),
        });

      if (arrivalRes.status !== 201) {
        console.error("ARRIVAL error:", arrivalRes.body);
      }
      expect(arrivalRes.status).toBe(201);

      // 3. Record VET_IN timing milestone: 21 minutes after ARRIVAL
      const vetInRes = await request(app.getHttpServer())
        .post("/timing/vet-in")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId,
          stageId: stage1Id,
          bibNumber,
          recordType: "VET_IN",
          recordedAt: new Date("2026-06-10T09:51:00Z").toISOString(), // 21 minutes!
        });

      if (vetInRes.status !== 201) {
        console.error("VET_IN error:", vetInRes.body);
      }
      expect(vetInRes.status).toBe(201);

      const timingRecordId = vetInRes.body.id;
      expect(vetInRes.body.isApproved).toBe(false);
      expect(vetInRes.body.eliminationType).toBe("TIME");
      expect(vetInRes.body.eliminated).toBe(true);

      // 4. Submit Vet Inspection details - should fail with 403 Forbidden
      const vetInspectionRes = await request(app.getHttpServer())
        .post("/vet-inspections")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({
          competitionId,
          vetGateNumber: 1,
          riderDorsal: String(bibNumber),
          arrivalTime: new Date("2026-06-10T09:30:00Z").toISOString(),
          vetInTime: new Date("2026-06-10T09:51:00Z").toISOString(),
          heartRate: 52,
          gaitStatus: "APPROVED",
          inspectionType: "STANDARD",
          requiresRecheck: false,
          notes: "Tested e2e",
        });

      expect(vetInspectionRes.status).toBe(403);

      // 5. Verify the timing record is not approved and eliminated with TIME code
      const updatedTiming = await dataSource.query(`
        SELECT is_approved, elimination_type, elimination_reason FROM timing_records WHERE id = '${timingRecordId}';
      `);
      expect(updatedTiming[0].is_approved).toBe(false);
      expect(updatedTiming[0].elimination_type).toBe("TIME");
      expect(updatedTiming[0].elimination_reason).toContain(
        "Fuera de tiempo de recuperación",
      );

      // 6. Verify entry status is updated to DQ
      const updatedEntry = await dataSource.query(`
        SELECT status FROM competition_entries WHERE id = '${entryId}';
      `);
      expect(updatedEntry[0].status).toBe("DQ");
    });

    it("should successfully approve and trigger next-stage start when VET_IN inspection passes within limits", async () => {
      // 1. Record START time (inserted directly to database as the API prohibits manual START registrations)
      const startRecordId = randomUUID();
      await dataSource.query(`
        INSERT INTO timing_records (id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved)
        VALUES ('${startRecordId}', 'a1000000-0000-0000-0000-000000000001', '${entryId}', '${stage1Id}', 'START', '2026-06-10 08:00:00-03', TRUE);
      `);

      // 2. Record ARRIVAL time
      const arrivalRes = await request(app.getHttpServer())
        .post("/timing")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId,
          stageId: stage1Id,
          bibNumber,
          recordType: "ARRIVAL",
          recordedAt: new Date("2026-06-10T09:30:00Z").toISOString(),
        });

      if (arrivalRes.status !== 201) {
        console.error("ARRIVAL error (2):", arrivalRes.body);
      }
      expect(arrivalRes.status).toBe(201);

      // 3. Record VET_IN timing milestone: 15 minutes after ARRIVAL
      const vetInRes = await request(app.getHttpServer())
        .post("/timing/vet-in")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId,
          stageId: stage1Id,
          bibNumber,
          recordType: "VET_IN",
          recordedAt: new Date("2026-06-10T09:45:00Z").toISOString(), // 15 minutes!
        });

      if (vetInRes.status !== 201) {
        console.error("VET_IN error (2):", vetInRes.body);
      }
      expect(vetInRes.status).toBe(201);

      const timingRecordId = vetInRes.body.id;

      // 4. Submit Vet Inspection details
      const vetInspectionRes = await request(app.getHttpServer())
        .post("/vet-inspections")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({
          competitionId,
          vetGateNumber: 1,
          riderDorsal: String(bibNumber),
          arrivalTime: new Date("2026-06-10T09:30:00Z").toISOString(),
          vetInTime: new Date("2026-06-10T09:45:00Z").toISOString(),
          heartRate: 52,
          gaitStatus: "APPROVED",
          inspectionType: "STANDARD",
          requiresRecheck: false,
          notes: "Tested e2e",
        });

      if (vetInspectionRes.status !== 201) {
        console.error("VET INSPECTION error (2):", vetInspectionRes.body);
      }
      expect(vetInspectionRes.status).toBe(201);

      // 5. Verify the timing record is approved and has no elimination
      const updatedTiming = await dataSource.query(`
        SELECT is_approved, elimination_type FROM timing_records WHERE id = '${timingRecordId}';
      `);
      expect(updatedTiming[0].is_approved).toBe(true);
      expect(updatedTiming[0].elimination_type).toBeNull();

      // 6. Verify entry status and stage are updated (started immediately because departure time has passed)
      const updatedEntry = await dataSource.query(`
        SELECT status, current_stage_id FROM competition_entries WHERE id = '${entryId}';
      `);
      expect(updatedEntry[0].status).toBe("IN_RACE");
      expect(updatedEntry[0].current_stage_id).toBe(stage2Id);

      // 7. Verify an automatic next-stage START timing record has been generated for stage 2 (60 min neutralization after ARRIVAL)
      // ARRIVAL = 09:30:00 + 60 min = 10:30:00
      const nextStageStart = await dataSource.query(`
        SELECT * FROM timing_records 
        WHERE entry_id = '${entryId}' AND stage_id = '${stage2Id}' AND record_type = 'START';
      `);
      expect(nextStageStart.length).toBe(1);
      expect(nextStageStart[0].is_approved).toBe(true);

      const expectedStartTime = new Date("2026-06-10T10:30:00Z").getTime();
      const actualStartTime = new Date(nextStageStart[0].recorded_at).getTime();
      expect(actualStartTime).toBe(expectedStartTime);
    });

    it("should register F.C.A. elimination reason when heart rate exceeds limit on recheck", async () => {
      // 1. Record START time
      const startRecordId = randomUUID();
      await dataSource.query(`
        INSERT INTO timing_records (id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved)
        VALUES ('${startRecordId}', 'a1000000-0000-0000-0000-000000000001', '${entryId}', '${stage1Id}', 'START', '2026-06-10 08:00:00-03', TRUE);
      `);

      // 2. Record ARRIVAL time
      await request(app.getHttpServer())
        .post("/timing")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId,
          stageId: stage1Id,
          bibNumber,
          recordType: "ARRIVAL",
          recordedAt: new Date("2026-06-10T09:30:00Z").toISOString(),
        });

      // 3. Record VET_IN timing milestone
      const vetInRes = await request(app.getHttpServer())
        .post("/timing/vet-in")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId,
          stageId: stage1Id,
          bibNumber,
          recordType: "VET_IN",
          recordedAt: new Date("2026-06-10T09:40:00Z").toISOString(),
        });

      const timingRecordId = vetInRes.body.id;

      // 4. Submit Re-inspection with heartRate = 68 (exceeding 65 limit)
      const vetInspectionRes = await request(app.getHttpServer())
        .post("/vet-inspections")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({
          competitionId,
          vetGateNumber: 1,
          riderDorsal: String(bibNumber),
          arrivalTime: new Date("2026-06-10T09:30:00Z").toISOString(),
          vetInTime: new Date("2026-06-10T09:40:00Z").toISOString(),
          heartRate: 68,
          gaitStatus: "APPROVED",
          inspectionType: "RE_INSPECTION_REQUESTED",
          requiresRecheck: false,
          notes: "Tested e2e F.C.A.",
        });

      expect(vetInspectionRes.status).toBe(201);

      // 5. Verify timing_record has eliminationReason starting with F.C.A.
      const updatedTiming = await dataSource.query(`
        SELECT is_approved, elimination_type, elimination_reason FROM timing_records WHERE id = '${timingRecordId}';
      `);
      expect(updatedTiming[0].is_approved).toBe(false);
      expect(updatedTiming[0].elimination_type).toBe("METABOLIC");
      expect(updatedTiming[0].elimination_reason).toMatch(/^F\.C\.A\./);
      expect(updatedTiming[0].elimination_reason).toContain("Frecuencia Cardíaca Alta");

      // 6. Verify entry status is ELIMINATED_PP
      const updatedEntry = await dataSource.query(`
        SELECT status FROM competition_entries WHERE id = '${entryId}';
      `);
      expect(updatedEntry[0].status).toBe("ELIMINATED_PP");
    });
  });

  describe("RFID Chips vs Manual Mode VET_IN Silent Flow", () => {
    const tenantId = "a1000000-0000-0000-0000-000000000001";
    let manualCompId: string;
    let chipCompId: string;
    let manualStage1Id: string;
    let manualStage2Id: string;
    let chipStage1Id: string;
    let chipStage2Id: string;
    const bibManual = 902;
    const bibChip = 903;

    beforeEach(async () => {
      await dataSource.query(
        `DELETE FROM competition_entries WHERE bib_number IN (${bibManual}, ${bibChip});`,
      );
      await dataSource.query(
        `DELETE FROM horses WHERE feu_id IN ('FEU-H-${bibManual}', 'FEU-H-${bibChip}');`,
      );
      await dataSource.query(
        `DELETE FROM riders WHERE feu_id IN ('FEU-R-${bibManual}', 'FEU-R-${bibChip}');`,
      );

      manualCompId = randomUUID();
      chipCompId = randomUUID();
      manualStage1Id = randomUUID();
      manualStage2Id = randomUUID();
      chipStage1Id = randomUUID();
      chipStage2Id = randomUUID();

      // Competition 1: Manual Mode (enable_rfid_chips = false)
      await dataSource.query(`
        INSERT INTO competitions (id, tenant_id, competition_type_id, name, status, location, competition_date, enable_rfid_chips)
        VALUES ('${manualCompId}', '${tenantId}', 'c1000000-0000-0000-0000-000000000001', 'Manual Mode Event', 'ACTIVE', 'Melo', '2026-06-10', FALSE);
      `);
      await dataSource.query(`
        INSERT INTO stages (id, tenant_id, competition_id, stage_number, distance_km, neutralization_minutes)
        VALUES 
          ('${manualStage1Id}', '${tenantId}', '${manualCompId}', 1, 30.00, 60),
          ('${manualStage2Id}', '${tenantId}', '${manualCompId}', 2, 20.00, 0);
      `);

      // Competition 2: Chip Mode (enable_rfid_chips = true)
      await dataSource.query(`
        INSERT INTO competitions (id, tenant_id, competition_type_id, name, status, location, competition_date, enable_rfid_chips)
        VALUES ('${chipCompId}', '${tenantId}', 'c1000000-0000-0000-0000-000000000001', 'Chip Mode Event', 'ACTIVE', 'Melo', '2026-06-10', TRUE);
      `);
      await dataSource.query(`
        INSERT INTO stages (id, tenant_id, competition_id, stage_number, distance_km, neutralization_minutes)
        VALUES 
          ('${chipStage1Id}', '${tenantId}', '${chipCompId}', 1, 30.00, 60),
          ('${chipStage2Id}', '${tenantId}', '${chipCompId}', 2, 20.00, 0);
      `);

      // Setup Horse, Rider, Entry for Manual
      const hManual = randomUUID();
      const rManual = randomUUID();
      const oManual = randomUUID();
      await dataSource.query(
        `INSERT INTO owners (id, name, type) VALUES ('${oManual}', 'Owner Manual', 'PERSON');`,
      );
      await dataSource.query(
        `INSERT INTO horses (id, name, feu_id, chip_id, is_feu_active, owner_id) VALUES ('${hManual}', 'Horse Manual', 'FEU-H-${bibManual}', 'CHIP-${bibManual}', TRUE, '${oManual}');`,
      );
      await dataSource.query(
        `INSERT INTO riders (id, name, national_id, feu_id, is_feu_active) VALUES ('${rManual}', 'Rider Manual', 'CI-${bibManual}', 'FEU-R-${bibManual}', TRUE);`,
      );
      const eManual = randomUUID();
      await dataSource.query(`
        INSERT INTO competition_entries (id, tenant_id, competition_id, rider_id, horse_id, bib_number, status, current_stage_id)
        VALUES ('${eManual}', '${tenantId}', '${manualCompId}', '${rManual}', '${hManual}', ${bibManual}, 'IN_RACE', '${manualStage1Id}');
      `);

      // Setup Horse, Rider, Entry for Chip
      const hChip = randomUUID();
      const rChip = randomUUID();
      const oChip = randomUUID();
      await dataSource.query(
        `INSERT INTO owners (id, name, type) VALUES ('${oChip}', 'Owner Chip', 'PERSON');`,
      );
      await dataSource.query(
        `INSERT INTO horses (id, name, feu_id, chip_id, is_feu_active, owner_id) VALUES ('${hChip}', 'Horse Chip', 'FEU-H-${bibChip}', 'CHIP-${bibChip}', TRUE, '${oChip}');`,
      );
      await dataSource.query(
        `INSERT INTO riders (id, name, national_id, feu_id, is_feu_active) VALUES ('${rChip}', 'Rider Chip', 'CI-${bibChip}', 'FEU-R-${bibChip}', TRUE);`,
      );
      const eChip = randomUUID();
      await dataSource.query(`
        INSERT INTO competition_entries (id, tenant_id, competition_id, rider_id, horse_id, bib_number, status, current_stage_id)
        VALUES ('${eChip}', '${tenantId}', '${chipCompId}', '${rChip}', '${hChip}', ${bibChip}, 'IN_RACE', '${chipStage1Id}');
      `);

      // Record START for both entries
      await dataSource.query(`
        INSERT INTO timing_records (id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved)
        VALUES 
          ('${randomUUID()}', '${tenantId}', '${eManual}', '${manualStage1Id}', 'START', '2026-06-10 07:00:00-03', TRUE),
          ('${randomUUID()}', '${tenantId}', '${eChip}', '${chipStage1Id}', 'START', '2026-06-10 07:00:00-03', TRUE);
      `);
    });

    it("Prueba 1: Modalidad Manual (enableRfidChips = false) - Autogenera VET_IN silencioso a las 08:20 y cambia status a VET_CHECK", async () => {
      const arrTime = new Date("2026-06-10T08:00:00Z");

      const response = await request(app.getHttpServer())
        .post("/timing")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId: manualCompId,
          stageId: manualStage1Id,
          bibNumber: bibManual,
          recordType: "ARRIVAL",
          recordedAt: arrTime.toISOString(),
        });

      expect(response.status).toBe(201);

      // Verify two records created for stage: ARRIVAL at 08:00 and automatic VET_IN at 08:20
      const records = await dataSource.query(`
        SELECT record_type, recorded_at, is_automatic FROM timing_records
        WHERE stage_id = '${manualStage1Id}' AND record_type IN ('ARRIVAL', 'VET_IN')
        ORDER BY recorded_at ASC;
      `);

      expect(records.length).toBe(2);
      expect(records[0].record_type).toBe("ARRIVAL");
      expect(records[1].record_type).toBe("VET_IN");
      expect(records[1].is_automatic).toBe(true);

      const expectedVetInMs = new Date("2026-06-10T08:20:00Z").getTime();
      expect(new Date(records[1].recorded_at).getTime()).toBe(expectedVetInMs);

      // Verify entry status changed to VET_CHECK
      const entryRes = await dataSource.query(`
        SELECT status FROM competition_entries WHERE bib_number = ${bibManual};
      `);
      expect(entryRes[0].status).toBe("VET_CHECK");

      // Verify POST /vet-inspections accepts inspection data without errors
      const vetRes = await request(app.getHttpServer())
        .post("/vet-inspections")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({
          competitionId: manualCompId,
          vetGateNumber: 1,
          riderDorsal: String(bibManual),
          arrivalTime: arrTime.toISOString(),
          vetInTime: new Date("2026-06-10T08:20:00Z").toISOString(),
          heartRate: 56,
          gaitStatus: "APPROVED",
          inspectionType: "STANDARD",
          requiresRecheck: false,
          notes: "Manual mode test ok",
        });

      if (vetRes.status !== 201) {
        console.error("vetRes error in Prueba 1:", vetRes.body);
      }
      expect(vetRes.status).toBe(201);
    });

    it("Prueba 2: Modalidad con Chip (enableRfidChips = true) - NO autogenera VET_IN silencioso y filtra estrictamente en /vet-inspections/pending", async () => {
      const arrTime = new Date("2026-06-10T08:00:00Z");

      const response = await request(app.getHttpServer())
        .post("/timing")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId: chipCompId,
          stageId: chipStage1Id,
          bibNumber: bibChip,
          recordType: "ARRIVAL",
          recordedAt: arrTime.toISOString(),
        });

      expect(response.status).toBe(201);

      // Verify ONLY 1 timing record (ARRIVAL) exists for chip mode
      const records = await dataSource.query(`
        SELECT record_type FROM timing_records
        WHERE stage_id = '${chipStage1Id}' AND record_type IN ('ARRIVAL', 'VET_IN');
      `);

      expect(records.length).toBe(1);
      expect(records[0].record_type).toBe("ARRIVAL");

      // Validar que el binomio con solo ARRIVAL NO aparezca en los pendientes del endpoint /vet-inspections/pending
      const pendingRes1 = await request(app.getHttpServer())
        .get(`/vet-inspections/pending?competitionId=${chipCompId}&stageNumber=1`)
        .set("Authorization", `Bearer ${vetToken}`);

      expect(pendingRes1.status).toBe(200);
      const matchedBeforeVetIn = pendingRes1.body.find(
        (e: any) => e.bibNumber === bibChip,
      );
      expect(matchedBeforeVetIn).toBeUndefined();

      // Emitir el VET_IN y actualizar status a VET_CHECK
      await dataSource.query(`
        UPDATE competition_entries SET status = 'VET_CHECK' WHERE bib_number = ${bibChip};
      `);
      await request(app.getHttpServer())
        .post("/timing/vet-in")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId: chipCompId,
          stageId: chipStage1Id,
          bibNumber: bibChip,
          recordType: "VET_IN",
          recordedAt: new Date("2026-06-10T08:15:00Z").toISOString(),
        });

      // Validar que ahora SÍ aparezca en /vet-inspections/pending
      const pendingRes2 = await request(app.getHttpServer())
        .get(`/vet-inspections/pending?competitionId=${chipCompId}&stageNumber=1`)
        .set("Authorization", `Bearer ${vetToken}`);

      expect(pendingRes2.status).toBe(200);
      const matchedAfterVetIn = pendingRes2.body.find(
        (e: any) => e.bibNumber === bibChip,
      );
      expect(matchedAfterVetIn).toBeDefined();
      expect(matchedAfterVetIn.bibNumber).toBe(bibChip);
    });
  });


  describe("Parametrización vetInspectionMode (SIMPLE vs DETAILED)", () => {
    let modeCompId: string;
    const tenantId = "a1000000-0000-0000-0000-000000000001";

    it("Prueba 1: Creación de Competencia asume vetInspectionMode = 'SIMPLE' por defecto", async () => {
      const res = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          tenantId,
          competitionTypeId: "c1000000-0000-0000-0000-000000000001",
          name: "Competencia Modo Test Simple",
          competitionDate: "2026-09-01",
          startTime: "07:00:00",
          isFederated: true,
          stages: [{ stageNumber: 1, distanceKm: 40, neutralizationMinutes: 60 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.vetInspectionMode).toBe("SIMPLE");
      modeCompId = res.body.id;

      // Verificar que registros históricos en la BD tengan 'SIMPLE' por defecto
      const dbRes = await dataSource.query(
        `SELECT vet_inspection_mode FROM competitions WHERE id = '${modeCompId}';`,
      );
      expect(dbRes[0].vet_inspection_mode).toBe("SIMPLE");
    });

    it("Prueba 2: Permite actualizar modalidad de inspección a 'DETAILED'", async () => {
      const updateRes = await request(app.getHttpServer())
        .patch(`/admin/competitions/${modeCompId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          vetInspectionMode: "DETAILED",
        });

      expect(updateRes.status).toBe(200);

      const dbRes = await dataSource.query(
        `SELECT vet_inspection_mode FROM competitions WHERE id = '${modeCompId}';`,
      );
      expect(dbRes[0].vet_inspection_mode).toBe("DETAILED");
    });
  });

  describe("FEU Recheck Flow & Protection Against False ELIMINATED_TR", () => {
    let recheckCompId: string;
    let stage1Id: string;
    let stage2Id: string;
    let entryId: string;
    let horseId: string;
    let riderId: string;
    let ownerId: string;
    const bibNumber = 944;
    const tenantId = "a1000000-0000-0000-0000-000000000001";

    beforeEach(async () => {
      // Clean up previous runs
      await dataSource.query(
        `DELETE FROM competition_entries WHERE bib_number = ${bibNumber};`,
      );
      await dataSource.query(
        `DELETE FROM horses WHERE feu_id = 'FEU-H-${bibNumber}';`,
      );
      await dataSource.query(
        `DELETE FROM riders WHERE feu_id = 'FEU-R-${bibNumber}';`,
      );

      recheckCompId = randomUUID();
      stage1Id = randomUUID();
      stage2Id = randomUUID();
      horseId = randomUUID();
      riderId = randomUUID();
      entryId = randomUUID();
      ownerId = randomUUID();

      await dataSource.query(`
        INSERT INTO competitions (id, tenant_id, competition_type_id, name, status, location, competition_date, enable_rfid_chips, max_heart_rate)
        VALUES ('${recheckCompId}', '${tenantId}', 'c1000000-0000-0000-0000-000000000001', 'Recheck Protection Competition', 'ACTIVE', 'Melo', '2026-06-10', FALSE, 65);
      `);

      await dataSource.query(`
        INSERT INTO stages (id, tenant_id, competition_id, stage_number, distance_km, neutralization_minutes)
        VALUES 
          ('${stage1Id}', '${tenantId}', '${recheckCompId}', 1, 30.00, 60),
          ('${stage2Id}', '${tenantId}', '${recheckCompId}', 2, 20.00, 0);
      `);

      await dataSource.query(`
        INSERT INTO owners (id, name, type) VALUES ('${ownerId}', 'Owner Recheck E2E', 'PERSON');
      `);

      await dataSource.query(`
        INSERT INTO horses (id, name, feu_id, chip_id, is_feu_active, owner_id)
        VALUES ('${horseId}', 'CONTRINCANTE REY', 'FEU-H-${bibNumber}', 'CHIP-${bibNumber}', TRUE, '${ownerId}');
      `);

      await dataSource.query(`
        INSERT INTO riders (id, name, national_id, feu_id, is_feu_active)
        VALUES ('${riderId}', 'FREDDY TECHERA MIRANDA', '8.888.888-8', 'FEU-R-${bibNumber}', TRUE);
      `);

      await dataSource.query(`
        INSERT INTO competition_entries (id, tenant_id, competition_id, rider_id, horse_id, bib_number, status, current_stage_id)
        VALUES ('${entryId}', '${tenantId}', '${recheckCompId}', '${riderId}', '${horseId}', ${bibNumber}, 'IN_RACE', '${stage1Id}');
      `);
    });

    afterEach(async () => {
      await dataSource.query(
        `DELETE FROM vet_inspections WHERE competence_id = '${recheckCompId}';`,
      );
      await dataSource.query(
        `DELETE FROM timing_records WHERE entry_id = '${entryId}';`,
      );
      await dataSource.query(
        `DELETE FROM competition_entries WHERE competition_id = '${recheckCompId}';`,
      );
      await dataSource.query(
        `DELETE FROM stages WHERE competition_id = '${recheckCompId}';`,
      );
      await dataSource.query(
        `DELETE FROM competitions WHERE id = '${recheckCompId}';`,
      );
      await dataSource.query(`DELETE FROM horses WHERE id = '${horseId}';`);
      await dataSource.query(`DELETE FROM riders WHERE id = '${riderId}';`);
      await dataSource.query(`DELETE FROM owners WHERE id = '${ownerId}';`);
    });

    it("should keep competitor in RESTING status and NOT disqualify as ELIMINATED_TR when recheck is approved", async () => {
      const baseTime = new Date("2026-06-10T11:25:56.000Z");

      // a) START record for Stage 1
      await dataSource.query(`
        INSERT INTO timing_records (id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved)
        VALUES ('${randomUUID()}', '${tenantId}', '${entryId}', '${stage1Id}', 'START', '${new Date(baseTime.getTime() - 120 * 60 * 1000).toISOString()}', TRUE);
      `);

      // b) Arribo a neutralización (11:25:56)
      const arrivalRes = await request(app.getHttpServer())
        .post("/timing")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId: recheckCompId,
          stageId: stage1Id,
          bibNumber,
          recordType: "ARRIVAL",
          recordedAt: baseTime.toISOString(),
        });
      expect(arrivalRes.status).toBe(201);

      // Record VET_IN milestone at 11:35:00 (min 9)
      const vetInTime = new Date(baseTime.getTime() + 9 * 60 * 1000);
      const vetInRes = await request(app.getHttpServer())
        .post("/timing/vet-in")
        .set("Authorization", `Bearer ${timekeeperToken}`)
        .send({
          competitionId: recheckCompId,
          stageId: stage1Id,
          bibNumber,
          recordType: "VET_IN",
          recordedAt: vetInTime.toISOString(),
        });
      expect(vetInRes.status).toBe(201);

      // c) 1st Vet Inspection at 11:35:00: Recheck requested
      const vetInspection1 = await request(app.getHttpServer())
        .post("/vet-inspections")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({
          competitionId: recheckCompId,
          vetGateNumber: 1,
          riderDorsal: String(bibNumber),
          arrivalTime: baseTime.toISOString(),
          vetInTime: vetInTime.toISOString(),
          heartRate: 72,
          gaitStatus: "APPROVED",
          inspectionType: "STANDARD",
          requiresRecheck: true,
        });
      expect(vetInspection1.status).toBe(201);

      // Verify entry status is VET_CHECK
      let entryDb = await dataSource.query(
        `SELECT status FROM competition_entries WHERE id = '${entryId}';`,
      );
      expect(entryDb[0].status).toBe("VET_CHECK");

      // d) 2nd Vet Inspection (Recheck) registered and approved at 12:05:05 (min 39) with 58 ppm
      const recheckTime = new Date(baseTime.getTime() + 39.15 * 60 * 1000);
      const recheckInspection = await request(app.getHttpServer())
        .post("/vet-inspections")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({
          competitionId: recheckCompId,
          vetGateNumber: 1,
          riderDorsal: String(bibNumber),
          arrivalTime: baseTime.toISOString(),
          vetInTime: vetInTime.toISOString(),
          heartRate: 58,
          gaitStatus: "APPROVED",
          inspectionType: "RE_INSPECTION_MANDATORY",
          requiresRecheck: false,
        });
      expect(recheckInspection.status).toBe(201);

      // Verify entry status is now RESTING
      entryDb = await dataSource.query(
        `SELECT status FROM competition_entries WHERE id = '${entryId}';`,
      );
      expect(entryDb[0].status).toBe("RESTING");

      // e) Simulate minute 60 (12:25:56) and execute ControlClosureScheduler & LeaderboardService
      const { ControlClosureScheduler } = await import(
        "../src/modules/timing/control-closure.scheduler"
      );
      const { LeaderboardService } = await import(
        "../src/modules/leaderboard/leaderboard.service"
      );
      const scheduler = app.get(ControlClosureScheduler);
      const leaderboardService = app.get(LeaderboardService);

      // Run Leaderboard update & ControlClosure check
      await leaderboardService.getLiveLeaderboard(recheckCompId);
      await scheduler.checkControlClosures();

      // f) Assertion: Competitor MUST remain RESTING and NOT be changed to ELIMINATED_TR
      entryDb = await dataSource.query(
        `SELECT status FROM competition_entries WHERE id = '${entryId}';`,
      );
      expect(entryDb[0].status).toBe("RESTING");
    });
  });
});
