import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";

describe("Security and Multi-Tenancy (e2e)", () => {
  let app: INestApplication;
  let adminToken: string;
  let judgeToken: string;
  let tenantBToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const dataSource = app.get(DataSource);
    await dataSource.query("DELETE FROM vet_inspections;");
    await dataSource.query("DELETE FROM timing_records;");
    await dataSource.query(
      "DELETE FROM competition_entries WHERE competition_id <> 'c2000000-0000-0000-0000-000000000001';",
    );
    await dataSource.query(
      "DELETE FROM stages WHERE competition_id <> 'c2000000-0000-0000-0000-000000000001';",
    );
    await dataSource.query(
      "DELETE FROM competitions WHERE id <> 'c2000000-0000-0000-0000-000000000001';",
    );
    await dataSource.query(
      "DELETE FROM users WHERE email NOT IN ('admin@equuscronos.com', 'juez@melo.uy', 'veterinario@melo.uy');",
    );

    const jwtService = app.get(JwtService);

    // 1. Obtener token de Administrador (admin@equuscronos.com / admin123)
    const adminLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@equuscronos.com", password: "admin123" })
      .expect(200);
    adminToken = adminLogin.body.access_token;

    // 2. Obtener token de Juez de Melo (juez@melo.uy / juez123)
    const judgeLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "juez@melo.uy", password: "juez123" })
      .expect(200);
    judgeToken = judgeLogin.body.access_token;

    // 3. Generar token firmado para Tenant B (Federación Ecuestre Uruguaya)
    tenantBToken = jwtService.sign({
      sub: "e1000000-0000-0000-0000-000000000099",
      email: "user@federacion.uy",
      role: "JUDGE",
      tenantId: "a1000000-0000-0000-0000-000000000002", // Tenant FEU (Montevideo)
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================================
  // DoD 1 & 2: Autenticación bcrypt y Token JWT
  // ==========================================================
  describe("POST /auth/login (Bcrypt / JWT)", () => {
    it("debería rechazar credenciales inválidas (contraseña incorrecta)", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "admin@equuscronos.com", password: "wrong_password" })
        .expect(401);
    });

    it("debería devolver un token JWT con la firma y estructura de payload esperada", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "admin@equuscronos.com", password: "admin123" })
        .expect(200);

      expect(res.body).toHaveProperty("access_token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.role).toBe("ADMIN");
      expect(res.body.user.tenantId).toBe(
        "a1000000-0000-0000-0000-000000000001",
      ); // Melo
    });
  });

  // ==========================================================
  // DoD 3: RolesGuard para endpoints sensibles (DELETE)
  // ==========================================================
  describe("RolesGuard - DELETE /admin/riders/:id", () => {
    it("debería devolver 403 Forbidden si el rol es JUDGE (No ADMIN)", async () => {
      const fakeRiderId = "f1000000-0000-0000-0000-000000000001";
      await request(app.getHttpServer())
        .delete(`/admin/riders/${fakeRiderId}`)
        .set("Authorization", `Bearer ${judgeToken}`)
        .expect(403);
    });

    it("debería permitir el paso si el rol es ADMIN (devuelve 200 o 404 si no existe)", async () => {
      const nonexistentRiderId = "f9999999-9999-9999-9999-999999999999";
      const res = await request(app.getHttpServer())
        .delete(`/admin/riders/${nonexistentRiderId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("no encontrado");
    });
  });

  // ==========================================================
  // DoD 4: Multi-Tenant RLS isolation
  // ==========================================================
  describe("Seguridad RLS (Row Level Security)", () => {
    it("debería aislar y filtrar registros en base al tenantId contenido en el token JWT", async () => {
      // 1. Consulta con token de Tenant A (Melo - tiene la competencia de Tupambaé)
      const resMelo = await request(app.getHttpServer())
        .get("/admin/competitions")
        .set("Authorization", `Bearer ${judgeToken}`)
        .expect(200);

      // Melo debe ver su competencia de Tupambaé
      expect(resMelo.body.length).toBeGreaterThanOrEqual(1);
      const tupambae = resMelo.body.find(
        (c: any) => c.name === "Raid Batalla de Tupambaé",
      );
      expect(tupambae).toBeDefined();

      // 2. Consulta con token de Tenant B (FEU - no tiene competencias asignadas en los seeds)
      const resFEU = await request(app.getHttpServer())
        .get("/admin/competitions")
        .set("Authorization", `Bearer ${tenantBToken}`)
        .expect(200);

      // El RLS de la base de datos debe filtrar automáticamente y no mostrar ninguna competencia para Tenant B
      expect(resFEU.body.length).toBe(0);
    });
  });
});
