import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tenants & Users Administration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Compile and initialize the full NestJS application module context
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Enable the exact global ValidationPipe to match the main.ts environment
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    
    await app.init();
  });

  afterAll(async () => {
    // Gracefully shutdown the app and close TypeORM database connections
    await app.close();
  });

  // ==========================================================
  // A. TENANTS CRUD INTEGRATION TESTING
  // ==========================================================
  describe('POST /admin/tenants', () => {
    it('should throw a 409 Conflict exception when attempting to create a tenant with a duplicate name', async () => {
      // Testing unique constraint to prevent duplicate club registration
      const duplicateTenant = {
        name: 'Sociedad Hípica de Melo', // Pre-seeded in 01_initial_seed.sql
        location: 'Melo, Cerro Largo',
      };

      return request(app.getHttpServer())
        .post('/admin/tenants')
        .send(duplicateTenant)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('ya existe');
        });
    });

    it('should successfully register a new tenant if the name is unique', async () => {
      const newTenant = {
        name: 'Club Hípico de San Ramón ' + Date.now(), // Dynamic name to ensure uniqueness
        location: 'Canelones, Uruguay',
      };

      const res = await request(app.getHttpServer())
        .post('/admin/tenants')
        .send(newTenant)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(newTenant.name);
    });
  });

  // ==========================================================
  // B. USERS CRUD INTEGRATION TESTING
  // ==========================================================
  describe('POST /admin/users', () => {
    const uniqueEmail = `test-staff-${Date.now()}@equuscronos.uy`;

    it('should link the user to a club successfully when a valid tenantId is provided', async () => {
      // Testing ManyToOne association persistence
      const validUserPayload = {
        name: 'Inspector Principal',
        email: uniqueEmail,
        role: 'JUDGE',
        tenantId: 'a1000000-0000-0000-0000-000000000001', // Melo pre-seeded tenant UUID
        passwordHash: 'SuperPassword123!',
      };

      const res = await request(app.getHttpServer())
        .post('/admin/users')
        .send(validUserPayload);

      console.log('RESPONSE STATUS:', res.status);
      console.log('RESPONSE BODY:', JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe(uniqueEmail);
      expect(res.body).toHaveProperty('tenant');
      expect(res.body.tenant.id).toBe(validUserPayload.tenantId);
      
      // Verify class-transformer output exclusion works (passwordHash must NOT be returned in API output)
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should throw a 404 NotFound exception when assigning a non-existent tenantId', async () => {
      // Testing foreign key validation before assignment to prevent orphaned users
      const invalidUserPayload = {
        name: 'Operador Inválido',
        email: `invalid-tenant-${Date.now()}@equuscronos.uy`,
        role: 'VET',
        tenantId: 'd1111111-1111-1111-1111-111111111111', // Random UUID
        passwordHash: 'InvalidPass123!',
      };

      const res = await request(app.getHttpServer())
        .post('/admin/users')
        .send(invalidUserPayload)
        .expect(404);

      expect(res.body.message).toBe('Club asignado no encontrado.');
    });
  });

  // ==========================================================
  // C. USERS RELATIONSHIP UPDATE TESTING
  // ==========================================================
  describe('PATCH /admin/users/:id', () => {
    let testUserId: string;

    beforeAll(async () => {
      // Setup a test user for updates
      const setupPayload = {
        name: 'Operador Temporal',
        email: `temp-staff-${Date.now()}@equuscronos.uy`,
        role: 'VET',
        tenantId: 'a1000000-0000-0000-0000-000000000001', // Start at Melo club
        passwordHash: 'Secret123!',
      };

      const res = await request(app.getHttpServer())
        .post('/admin/users')
        .send(setupPayload)
        .expect(201);

      testUserId = res.body.id;
    });

    it('should update the tenant relationship successfully when tenantId is changed to a different valid club', async () => {
      // Testing transaction integrity during update flow
      const updatePayload = {
        tenantId: 'a1000000-0000-0000-0000-000000000002', // Change to Montevideo club
      };

      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${testUserId}`)
        .send(updatePayload)
        .expect(200);

      expect(res.body.id).toBe(testUserId);
      expect(res.body).toHaveProperty('tenant');
      expect(res.body.tenant.id).toBe(updatePayload.tenantId);
    });

    it('should fail with 404 NotFound if updating the tenantId to a non-existent club UUID', async () => {
      const badUpdatePayload = {
        tenantId: 'd1111111-1111-1111-1111-111111111111',
      };

      return request(app.getHttpServer())
        .patch(`/admin/users/${testUserId}`)
        .send(badUpdatePayload)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Club asignado no encontrado.');
        });
    });
  });
});
