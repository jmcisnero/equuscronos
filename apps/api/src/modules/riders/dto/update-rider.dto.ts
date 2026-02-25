import { PartialType } from '@nestjs/mapped-types';
import { CreateRiderDto } from './create-rider.dto';

// Hereda todas las validaciones de CreateRiderDto pero las hace opcionales
export class UpdateRiderDto extends PartialType(CreateRiderDto) {}
