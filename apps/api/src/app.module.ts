import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
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
    TenantsModule,
    OwnersModule,
    UsersModule,
    CompetitionTypesModule,
    HorsesModule,
    RidersModule,
    CompetitionsModule,
    CompetitionEntriesModule,
    TimingModule,
  ],
})
export class AppModule {}
