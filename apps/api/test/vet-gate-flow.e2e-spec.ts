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
        INSERT INTO competitions (id, tenant_id, competition_type_id, name, status, location, competition_date)
        VALUES ('${competitionId}', '${tenantId}', 'c1000000-0000-0000-0000-000000000001', 'Test E2E Competition', 'ACTIVE', 'Melo', '2026-06-10');
      `);

      await dataSource.query(`
        INSERT INTO stages (id, tenant_id, competition_id, stage_number, distance_km, neutralization_minutes)
        VALUES 
          ('${stage1Id}', '${tenantId}', '${competitionId}', 1, 30.00, 30),
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
      await dataSource.query(`DELETE FROM vet_inspections;`);
      await dataSource.query(`DELETE FROM timing_records;`);
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
          timingRecordId,
          heartRate: 52,
          temperature: 38.2,
          motricity: "APTO",
          metabolic: "NORMAL",
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
          timingRecordId,
          heartRate: 52,
          temperature: 38.2,
          motricity: "APTO",
          metabolic: "NORMAL",
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
  });
});
