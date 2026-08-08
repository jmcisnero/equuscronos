import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";

describe("Rider & Horse Flexibility Validation (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

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
  });

  afterAll(async () => {
    // Cleanup test riders and horses
    await dataSource.query(
      `DELETE FROM riders WHERE name LIKE 'Flex Rider%';`,
    );
    await dataSource.query(
      `DELETE FROM horses WHERE name LIKE 'Flex Horse%';`,
    );
    await app.close();
  });

  it("should create a rider with ONLY name (nationalId empty/omitted)", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/riders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Flex Rider One",
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Flex Rider One");
    expect(res.body.nationalId).toBeNull();
    expect(res.body.isFeuActive).toBe(true);
  });

  it("should create a SECOND rider with ONLY name without constraint collision", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/riders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Flex Rider Two",
        nationalId: "",
        feuId: "",
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Flex Rider Two");
    expect(res.body.nationalId).toBeNull();
  });

  it("should create a horse with default isFeuActive=true and null health records", async () => {
    const ownerId = randomUUID();
    await dataSource.query(
      `INSERT INTO owners (id, name, type) VALUES ('${ownerId}', 'Flex Owner', 'PERSON');`,
    );

    const res = await request(app.getHttpServer())
      .post("/admin/horses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Flex Horse One",
        ownerId,
        healthRecordsExpiration: "",
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Flex Horse One");
    expect(res.body.isFeuActive).toBe(true);
    expect(res.body.healthRecordsExpiration).toBeNull();

    await dataSource.query(`DELETE FROM owners WHERE id = '${ownerId}';`);
  });
});
