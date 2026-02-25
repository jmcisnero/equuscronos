import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { Rider } from './entities/rider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rider])],
  controllers: [RidersController],
  providers: [RidersService],
  exports: [RidersService], // Exportamos por si otro módulo necesita buscar jinetes
})
export class RidersModule {}
