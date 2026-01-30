import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('EquusCronos-API');
  const app = await NestFactory.create(AppModule);
  
  // Habilitar CORS para que las Apps Mobile y Web puedan conectarse
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`Sistema de Gestión de Competencias Ecuestres corriendo en: http://localhost:${port}`);
}
bootstrap();
