import { PartialType } from '@nestjs/mapped-types';
import { CreateHorseDto } from './create-horse.dto';

// Hereda todas las validaciones de CreateHorseDto pero las hace opcionales
export class UpdateHorseDto extends PartialType(CreateHorseDto) {}
