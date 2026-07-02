import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { DataSource } from "typeorm";
import { CompetitionStatus } from "@equuscronos/shared";

describe("Competitions Stages Mutation (e2e)", () => {
  let app: INestApplication;
  let adminToken: string;
  let dataSource: DataSource;
  const createdCompetitionIds: string[] = [];

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

    // Obtener token del usuario seeded ADMIN
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
    await app.close();
  });

  describe("PATCH /admin/competitions/:id (Stages update)", () => {
    it("debería actualizar con éxito las distancias de las etapas y añadir/remover etapas de una competencia PLANNED", async () => {
      // 1. Crear una competencia con 2 etapas
      const createPayload = {
        tenantId: "a1000000-0000-0000-0000-000000000001",
        competitionTypeId: "c1000000-0000-0000-0000-000000000001",
        name: "Test Mutation PLANNED " + Date.now(),
        competitionDate: "2026-08-10",
        startTime: "07:30:00",
        stages: [
          { stageNumber: 1, distanceKm: 40.0, neutralizationMinutes: 60 },
          { stageNumber: 2, distanceKm: 20.0, neutralizationMinutes: 0 },
        ],
      };

      const createRes = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(createPayload)
        .expect(201);

      const competitionId = createRes.body.id;
      createdCompetitionIds.push(competitionId);

      // Verificar que se crearon las 2 etapas correctamente
      expect(createRes.body.stages.length).toBe(2);

      // 2. Modificar las etapas: cambiar distancia de la 1, añadir la 3, omitir la 2 (huérfana)
      const updatePayload = {
        stages: [
          { stageNumber: 1, distanceKm: 45.5, neutralizationMinutes: 50 },
          { stageNumber: 3, distanceKm: 15.0, neutralizationMinutes: 0 },
        ],
      };

      const updateRes = await request(app.getHttpServer())
        .patch(`/admin/competitions/${competitionId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updatePayload)
        .expect(200);

      // Verificar respuesta
      const updatedStages = updateRes.body.stages;
      expect(updatedStages.length).toBe(2);

      const stage1 = updatedStages.find((s: any) => s.stageNumber === 1);
      const stage3 = updatedStages.find((s: any) => s.stageNumber === 3);
      const stage2 = updatedStages.find((s: any) => s.stageNumber === 2);

      expect(stage1).toBeDefined();
      expect(Number(stage1.distanceKm)).toBe(45.5);
      expect(stage1.neutralizationMinutes).toBe(50);

      expect(stage3).toBeDefined();
      expect(Number(stage3.distanceKm)).toBe(15.0);

      expect(stage2).toBeUndefined(); // Eliminado correctamente
    });

    it("debería rechazar cualquier intento de modificación de etapas si la competencia está en estado ACTIVE", async () => {
      // 1. Crear una competencia PLANNED
      const createPayload = {
        tenantId: "a1000000-0000-0000-0000-000000000001",
        competitionTypeId: "c1000000-0000-0000-0000-000000000001",
        name: "Test Mutation ACTIVE " + Date.now(),
        competitionDate: "2026-08-11",
        startTime: "07:30:00",
        stages: [
          { stageNumber: 1, distanceKm: 40.0, neutralizationMinutes: 60 },
        ],
      };

      const createRes = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(createPayload)
        .expect(201);

      const competitionId = createRes.body.id;
      createdCompetitionIds.push(competitionId);

      // 2. Modificar el estado a ACTIVE en la base de datos de manera directa para evitar validaciones de largada FEU temporales
      await dataSource.query(
        `UPDATE competitions SET status = 'ACTIVE' WHERE id = $1`,
        [competitionId],
      );

      // 3. Intentar mutar etapas vía API
      const updatePayload = {
        stages: [
          { stageNumber: 1, distanceKm: 50.0, neutralizationMinutes: 60 },
        ],
      };

      const updateRes = await request(app.getHttpServer())
        .patch(`/admin/competitions/${competitionId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updatePayload)
        .expect(400);

      expect(updateRes.body.message).toBe(
        "No se pueden modificar las etapas de una competencia activa o finalizada",
      );
    });
  });
});
