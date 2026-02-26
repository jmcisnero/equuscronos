import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Habilitar CORS
  app.enableCors({ origin: '*' }); // Ajustar en producción

  // 2. Activar validaciones globales de DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 3. Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('EquusCronos API')
    .setDescription('Motor transaccional y Backoffice para competencias ecuestres (MVP)')
    .setVersion('1.0')
    // Agregamos el candado de seguridad JWT a la documentación
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token', // Nombre de la referencia de seguridad
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // La documentación vivirá en http://localhost:3000/api
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true }, // Mantiene la sesión si recargan la página
  });

  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 EquusCronos API corriendo en: http://localhost:3000`);
  console.log(`📖 Documentación Swagger en: http://localhost:3000/api`);
}
bootstrap();
