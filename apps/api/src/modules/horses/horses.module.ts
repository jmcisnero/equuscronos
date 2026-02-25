import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HorsesService } from './horses.service';
import { HorsesController } from './horses.controller';
import { Horse } from './entities/horse.entity';
import { Owner } from '../owners/entities/owner.entity'; // Necesario para la validación

@Module({
  imports: [TypeOrmModule.forFeature([Horse, Owner])],
  controllers: [HorsesController],
  providers: [HorsesService],
  exports: [HorsesService],
})
export class HorsesModule {}
