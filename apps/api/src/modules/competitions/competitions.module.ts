import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import { Competition } from './entities/competition.entity';
import { Stage } from './entities/stage.entity';

@Module({
  imports: [
    // Registramos las entidades principales de este dominio (bounded context)
    TypeOrmModule.forFeature([Competition, Stage])
  ],
  controllers: [CompetitionsController],
  providers: [CompetitionsService],
  exports: [CompetitionsService], // Lo exportamos por si otros módulos necesitan consultar datos de la carrera
})
export class CompetitionsModule {}
