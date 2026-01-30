import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    // Carga de variables de entorno (.env)
    ConfigModule.forRoot({ isGlobal: true }),
    
    // Configuración de la conexión a PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'equus_secure_pass_2026',
      database: process.env.DB_NAME || 'equuscronos',
      autoLoadEntities: true, // Busca automáticamente los modelos que crearemos
      synchronize: false,    // ¡IMPORTANTE! Usamos nuestras migraciones, no dejamos que TypeORM cambie la tabla solo.
      logging: ['query', 'error'], // Para ver qué está pasando en la consola
    }),
  ],
})
export class AppModule {}
