import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Tenants & Users Administration (e2e)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    // Compila e inicializa el contexto de la aplicación NestJS
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Habilita el ValidationPipe global para coincidir con main.ts
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();

    // Obtener un token JWT válido iniciando sesión con el usuario seeded ADMIN
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "admin@equuscronos.com",
        password: "admin123",
      })
      .expect(200);

    adminToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    // Apaga graciosamente la aplicación y cierra conexiones
    await app.close();
  });

  // ==========================================================
  // PRUEBA DE CONTROL DE ACCESO (DoD 1: 401 sin Token)
  // ==========================================================
  describe("Acceso Protegido a /admin/*", () => {
    it("debería devolver 401 Unauthorized al intentar acceder sin cabecera de Autorización", async () => {
      return request(app.getHttpServer()).get("/admin/tenants").expect(401);
    });
  });

  // ==========================================================
  // A. TENANTS CRUD INTEGRATION TESTING
  // ==========================================================
  describe("POST /admin/tenants", () => {
    it("should throw a 409 Conflict exception when attempting to create a tenant with a duplicate name", async () => {
      const duplicateTenant = {
        name: "Sociedad Hípica de Melo", // Pre-seeded
        location: "Melo, Cerro Largo",
      };

      return request(app.getHttpServer())
        .post("/admin/tenants")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicateTenant)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain("ya existe");
        });
    });

    it("should successfully register a new tenant if the name is unique", async () => {
      const newTenant = {
        name: "Club Hípico de San Ramón " + Date.now(),
        location: "Canelones, Uruguay",
      };

      const res = await request(app.getHttpServer())
        .post("/admin/tenants")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(newTenant)
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe(newTenant.name);
    });
  });

  // ==========================================================
  // B. USERS CRUD INTEGRATION TESTING
  // ==========================================================
  describe("POST /admin/users", () => {
    const uniqueEmail = `test-staff-${Date.now()}@equuscronos.uy`;

    it("should link the user to a club successfully when a valid tenantId is provided", async () => {
      const validUserPayload = {
        name: "Inspector Principal",
        email: uniqueEmail,
        role: "JUDGE",
        tenantId: "a1000000-0000-0000-0000-000000000001", // Melo pre-seeded tenant UUID
        passwordHash: "SuperPassword123!",
      };

      const res = await request(app.getHttpServer())
        .post("/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(validUserPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.email).toBe(uniqueEmail);
      expect(res.body).toHaveProperty("tenant");
      expect(res.body.tenant.id).toBe(validUserPayload.tenantId);

      // Verifica que el hash de contraseña esté excluido del output
      expect(res.body).not.toHaveProperty("passwordHash");
    });

    it("should throw a 404 NotFound exception when assigning a non-existent tenantId", async () => {
      const invalidUserPayload = {
        name: "Operador Inválido",
        email: `invalid-tenant-${Date.now()}@equuscronos.uy`,
        role: "VET",
        tenantId: "d1111111-1111-1111-1111-111111111111",
        passwordHash: "InvalidPass123!",
      };

      const res = await request(app.getHttpServer())
        .post("/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidUserPayload)
        .expect(404);

      expect(res.body.message).toBe("Club asignado no encontrado.");
    });
  });

  // ==========================================================
  // C. USERS RELATIONSHIP UPDATE TESTING
  // ==========================================================
  describe("PATCH /admin/users/:id", () => {
    let testUserId: string;

    beforeAll(async () => {
      const setupPayload = {
        name: "Operador Temporal",
        email: `temp-staff-${Date.now()}@equuscronos.uy`,
        role: "VET",
        tenantId: "a1000000-0000-0000-0000-000000000001",
        passwordHash: "Secret123!",
      };

      const res = await request(app.getHttpServer())
        .post("/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(setupPayload)
        .expect(201);

      testUserId = res.body.id;
    });

    it("should update the tenant relationship successfully when tenantId is changed to a different valid club", async () => {
      const updatePayload = {
        tenantId: "a1000000-0000-0000-0000-000000000002",
      };

      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${testUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updatePayload)
        .expect(200);

      expect(res.body.id).toBe(testUserId);
      expect(res.body).toHaveProperty("tenant");
      expect(res.body.tenant.id).toBe(updatePayload.tenantId);
    });

    it("should fail with 404 NotFound if updating the tenantId to a non-existent club UUID", async () => {
      const badUpdatePayload = {
        tenantId: "d1111111-1111-1111-1111-111111111111",
      };

      return request(app.getHttpServer())
        .patch(`/admin/users/${testUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(badUpdatePayload)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe("Club asignado no encontrado.");
        });
    });
  });
});
