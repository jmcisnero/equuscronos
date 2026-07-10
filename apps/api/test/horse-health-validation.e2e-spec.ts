import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";

describe("Horse Health Records Expiration Validation (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let competitionId: string;
  let tenantId: string;
  const testBibBase = 800;

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

    // Login as Admin
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@equuscronos.com", password: "admin123" })
      .expect(200);
    adminToken = loginRes.body.access_token;

    tenantId = "a1000000-0000-0000-0000-000000000001";
    competitionId = randomUUID();

    // Create a competition for testing date: 2026-06-10
    await dataSource.query(`
      INSERT INTO competitions (id, tenant_id, competition_type_id, name, status, location, competition_date)
      VALUES ('${competitionId}', '${tenantId}', 'c1000000-0000-0000-0000-000000000001', 'Health Test Competition', 'PLANNED', 'Melo', '2026-06-10');
    `);
  });

  afterAll(async () => {
    // Cleanup
    await dataSource.query(`DELETE FROM competition_entries WHERE competition_id = '${competitionId}';`);
    await dataSource.query(`DELETE FROM competitions WHERE id = '${competitionId}';`);
    await dataSource.query(`DELETE FROM horses WHERE name LIKE 'Health Test Horse%';`);
    await dataSource.query(`DELETE FROM riders WHERE name LIKE 'Health Test Rider%';`);
    await dataSource.query(`DELETE FROM owners WHERE name = 'Health Test Owner';`);
    await app.close();
  });

  it("should permit entry when horse.healthRecordsExpiration is NULL (Contingency)", async () => {
    const horseId = randomUUID();
    const riderId = randomUUID();
    const ownerId = randomUUID();
    const bibNumber = testBibBase + 1;

    await dataSource.query(`INSERT INTO owners (id, name, type) VALUES ('${ownerId}', 'Health Test Owner', 'PERSON');`);
    
    // Horse with null healthRecordsExpiration
    await dataSource.query(`
      INSERT INTO horses (id, owner_id, name, feu_id, chip_id, is_feu_active, health_records_expiration)
      VALUES ('${horseId}', '${ownerId}', 'Health Test Horse 1', 'FEU-H-${bibNumber}', 'CHIP-${bibNumber}', TRUE, NULL);
    `);

    await dataSource.query(`
      INSERT INTO riders (id, name, national_id, feu_id, is_feu_active)
      VALUES ('${riderId}', 'Health Test Rider 1', '8.999.999-1', 'FEU-R-${bibNumber}', TRUE);
    `);

    // Attempt registration
    const res = await request(app.getHttpServer())
      .post("/admin/entries")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        competitionId,
        riderId,
        horseId,
        bibNumber,
      });

    expect(res.status).toBe(201);
  });

  it("should permit entry when horse.healthRecordsExpiration is in the future (Valid)", async () => {
    const horseId = randomUUID();
    const riderId = randomUUID();
    const ownerId = randomUUID();
    const bibNumber = testBibBase + 2;

    await dataSource.query(`INSERT INTO owners (id, name, type) VALUES ('${ownerId}', 'Health Test Owner', 'PERSON');`);
    
    // Horse with valid future healthRecordsExpiration (2026-12-31 is after competition date 2026-06-10)
    await dataSource.query(`
      INSERT INTO horses (id, owner_id, name, feu_id, chip_id, is_feu_active, health_records_expiration)
      VALUES ('${horseId}', '${ownerId}', 'Health Test Horse 2', 'FEU-H-${bibNumber}', 'CHIP-${bibNumber}', TRUE, '2026-12-31');
    `);

    await dataSource.query(`
      INSERT INTO riders (id, name, national_id, feu_id, is_feu_active)
      VALUES ('${riderId}', 'Health Test Rider 2', '8.999.999-2', 'FEU-R-${bibNumber}', TRUE);
    `);

    // Attempt registration
    const res = await request(app.getHttpServer())
      .post("/admin/entries")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        competitionId,
        riderId,
        horseId,
        bibNumber,
      });

    expect(res.status).toBe(201);
  });

  it("should reject entry with 400 Bad Request when horse.healthRecordsExpiration is in the past (Expired)", async () => {
    const horseId = randomUUID();
    const riderId = randomUUID();
    const ownerId = randomUUID();
    const bibNumber = testBibBase + 3;

    await dataSource.query(`INSERT INTO owners (id, name, type) VALUES ('${ownerId}', 'Health Test Owner', 'PERSON');`);
    
    // Horse with expired healthRecordsExpiration (2026-05-10 is before competition date 2026-06-10)
    await dataSource.query(`
      INSERT INTO horses (id, owner_id, name, feu_id, chip_id, is_feu_active, health_records_expiration)
      VALUES ('${horseId}', '${ownerId}', 'Health Test Horse 3', 'FEU-H-${bibNumber}', 'CHIP-${bibNumber}', TRUE, '2026-05-10');
    `);

    await dataSource.query(`
      INSERT INTO riders (id, name, national_id, feu_id, is_feu_active)
      VALUES ('${riderId}', 'Health Test Rider 3', '8.999.999-3', 'FEU-R-${bibNumber}', TRUE);
    `);

    // Attempt registration
    const res = await request(app.getHttpServer())
      .post("/admin/entries")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        competitionId,
        riderId,
        horseId,
        bibNumber,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("vencida");
  });
});
