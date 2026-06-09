// --- PATCH TYPEORM POSTGRES QUERY RUNNER FOR RLS ISOLATION ---
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import { tenantStorage } from './modules/auth/tenant.storage';

const originalQuery = PostgresQueryRunner.prototype.query;
PostgresQueryRunner.prototype.query = async function (
  this: PostgresQueryRunner,
  query: string,
  parameters?: any[],
  useZeroQuery?: boolean,
) {
  const store = tenantStorage.getStore();
  const tenantId = store?.tenantId || '';
  if (
    !query.includes('app.current_tenant_id') && 
    !query.includes('set_config') &&
    !query.includes('SET LOCAL')
  ) {
    const isTx = this.isTransactionActive;
    await originalQuery.call(
      this,
      `SELECT set_config('app.current_tenant_id', $1, $2)`,
      [tenantId || '', isTx],
    );
  }
  return originalQuery.call(this, query, parameters, useZeroQuery);
};
// -------------------------------------------------------------

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Importación de los Módulos de Dominio (Backoffice & Motor de Carrera)
import { TenantsModule } from './modules/tenants/tenants.module';
import { OwnersModule } from './modules/owners/owners.module';
import { UsersModule } from './modules/users/users.module';
import { CompetitionTypesModule } from './modules/competition-types/competition-types.module';
import { HorsesModule } from './modules/horses/horses.module';
import { RidersModule } from './modules/riders/riders.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { CompetitionEntriesModule } from './modules/competition-entries/competition-entries.module';
import { TimingModule } from './modules/timing/timing.module';
import { AuditModule } from './modules/audit/audit.module';
import { WeightControlsModule } from './modules/weight-controls/weight-controls.module';
import { VetInspectionsModule } from './modules/vet-inspections/vet-inspections.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { AuthModule } from './modules/auth/auth.module';

// Guards & Interceptors Globales
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { TenantInterceptor } from './modules/auth/interceptors/tenant.interceptor';

@Module({
  imports: [
    // 1. Carga de variables de entorno (.env)
    ConfigModule.forRoot({ isGlobal: true }),
    
    // 2. Configuración de la conexión a PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'equus_secure_pass_2026',
      database: process.env.DB_NAME || 'equuscronos',
      autoLoadEntities: true, // TypeORM encuentra las entidades que registramos en cada módulo
      synchronize: false,     // IMPORTANTE! La estructura la mandan los scripts SQL, no el código.
      logging: ['query', 'error'],
    }),

    // 3. Registro de Módulos (Rutas y Lógica de Negocio)
    AuthModule,
    TenantsModule,
    OwnersModule,
    UsersModule,
    CompetitionTypesModule,
    HorsesModule,
    RidersModule,
    CompetitionsModule,
    CompetitionEntriesModule,
    TimingModule,
    AuditModule,
    WeightControlsModule,
    VetInspectionsModule,
    DashboardModule,
    LeaderboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
