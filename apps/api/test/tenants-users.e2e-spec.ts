import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Tenants & Users Administration (e2e)", () => {
  let app: INestApplication;
  let adminToken: string;
  const createdUserIds: string[] = [];
  const createdCompetitionIds: string[] = [];

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
    // Eliminar las competencias creadas para limpiar la base de datos
    for (const compId of createdCompetitionIds) {
      try {
        await request(app.getHttpServer())
          .delete(`/admin/competitions/${compId}`)
          .set("Authorization", `Bearer ${adminToken}`);
      } catch (e) {
        // Ignorar
      }
    }
    // Eliminar los usuarios creados para limpiar la base de datos
    for (const userId of createdUserIds) {
      try {
        await request(app.getHttpServer())
          .delete(`/admin/users/${userId}`)
          .set("Authorization", `Bearer ${adminToken}`);
      } catch (e) {
        // Ignorar
      }
    }
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
      createdUserIds.push(res.body.id);
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

    it("should create a CLUB_ADMIN linked to a valid tenantId and verify password is hash (excluded from output)", async () => {
      const clubAdminPayload = {
        name: "Admin de Melo",
        email: `club-admin-${Date.now()}@equuscronos.uy`,
        role: "CLUB_ADMIN",
        tenantId: "a1000000-0000-0000-0000-000000000001", // Melo pre-seeded tenant UUID
        passwordHash: "ClubAdminPass123!",
      };

      const res = await request(app.getHttpServer())
        .post("/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(clubAdminPayload)
        .expect(201);

      createdUserIds.push(res.body.id);
      expect(res.body).toHaveProperty("id");
      expect(res.body.email).toBe(clubAdminPayload.email);
      expect(res.body.role).toBe("CLUB_ADMIN");
      expect(res.body).toHaveProperty("tenant");
      expect(res.body.tenant.id).toBe(clubAdminPayload.tenantId);
      expect(res.body).not.toHaveProperty("passwordHash");
    });

    it("should reject creating a CLUB_ADMIN without a tenantId with a 400 Bad Request error", async () => {
      const orphanedClubAdminPayload = {
        name: "Admin Huerfano",
        email: `orphaned-admin-${Date.now()}@equuscronos.uy`,
        role: "CLUB_ADMIN",
        passwordHash: "ClubAdminPass123!",
      };

      const res = await request(app.getHttpServer())
        .post("/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(orphanedClubAdminPayload)
        .expect(400);

      expect(res.body.message).toContain(
        "El club/organización es obligatorio para el rol CLUB_ADMIN",
      );
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
      createdUserIds.push(testUserId);
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

  // ==========================================================
  // D. CLUB_ADMIN MULTI-TENANT DATA GOVERNANCE & ISOLATION
  // ==========================================================
  describe("Gobernanza de Datos Multi-Tenant para CLUB_ADMIN (e2e)", () => {
    let clubAdminToken: string;
    let clubAdminEmail: string;
    const tenantMeloId = "a1000000-0000-0000-0000-000000000001";
    const tenantOtherId = "a1000000-0000-0000-0000-000000000002"; // Sociedad Hípica de Flores

    beforeAll(async () => {
      // 1. Crear un usuario CLUB_ADMIN para el Tenant de Melo
      clubAdminEmail = `club-admin-gov-${Date.now()}@equuscronos.uy`;
      const res = await request(app.getHttpServer())
        .post("/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Admin de Melo Test",
          email: clubAdminEmail,
          role: "CLUB_ADMIN",
          tenantId: tenantMeloId,
          passwordHash: "ClubAdminPass123!",
        })
        .expect(201);

      createdUserIds.push(res.body.id);

      // 2. Iniciar sesión con este CLUB_ADMIN
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: clubAdminEmail,
          password: "ClubAdminPass123!",
        })
        .expect(200);

      clubAdminToken = loginRes.body.access_token;
    });

    it("debería permitir a un CLUB_ADMIN listar datos globales (GET /admin/horses, riders, owners, competition-types)", async () => {
      await request(app.getHttpServer())
        .get("/admin/horses")
        .set("Authorization", `Bearer ${clubAdminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get("/admin/riders")
        .set("Authorization", `Bearer ${clubAdminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get("/admin/owners")
        .set("Authorization", `Bearer ${clubAdminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get("/admin/competition-types")
        .set("Authorization", `Bearer ${clubAdminToken}`)
        .expect(200);
    });

    it("debería denegar a un CLUB_ADMIN la creación o modificación de datos globales (POST /admin/horses -> 403)", async () => {
      await request(app.getHttpServer())
        .post("/admin/horses")
        .set("Authorization", `Bearer ${clubAdminToken}`)
        .send({
          name: "Caballo No Autorizado",
          gatePass: "12345",
        })
        .expect(403);
    });

    it("debería ignorar el tenantId provisto en el body al crear una competencia y forzar el del CLUB_ADMIN", async () => {
      const competitionPayload = {
        tenantId: tenantOtherId, // Inyección maliciosa
        competitionTypeId: "c1000000-0000-0000-0000-000000000001",
        name: "Carrera Segura Club Admin " + Date.now(),
        competitionDate: "2026-07-20",
        startTime: "08:00:00",
        stages: [
          { stageNumber: 1, distanceKm: 40, neutralizationMinutes: 60 },
          { stageNumber: 2, distanceKm: 20, neutralizationMinutes: 0 },
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set("Authorization", `Bearer ${clubAdminToken}`)
        .send(competitionPayload)
        .expect(201);

      createdCompetitionIds.push(res.body.id);

      // Verificamos que se haya creado bajo Melo (tenantId del CLUB_ADMIN) y no Flores
      expect(res.body.tenant.id).toBe(tenantMeloId);
    });

    it("debería devolver 404 al intentar acceder o modificar una competencia de otro Tenant (aislamiento RLS)", async () => {
      const floresCompPayload = {
        tenantId: tenantOtherId,
        competitionTypeId: "c1000000-0000-0000-0000-000000000001",
        name: "Carrera de Flores " + Date.now(),
        competitionDate: "2026-07-22",
        startTime: "08:00:00",
        stages: [
          { stageNumber: 1, distanceKm: 40, neutralizationMinutes: 60 },
          { stageNumber: 2, distanceKm: 20, neutralizationMinutes: 0 },
        ],
      };

      const creationRes = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(floresCompPayload)
        .expect(201);

      const floresCompId = creationRes.body.id;
      createdCompetitionIds.push(floresCompId);

      // Intentar leer esta competencia con el token del CLUB_ADMIN de Melo -> debería dar 404
      await request(app.getHttpServer())
        .get(`/admin/competitions/${floresCompId}`)
        .set("Authorization", `Bearer ${clubAdminToken}`)
        .expect(404);

      // Intentar actualizar esta competencia con el token del CLUB_ADMIN de Melo -> debería dar 404
      await request(app.getHttpServer())
        .patch(`/admin/competitions/${floresCompId}`)
        .set("Authorization", `Bearer ${clubAdminToken}`)
        .send({ name: "Intento de Hackeo" })
        .expect(404);
    });
  });
});
