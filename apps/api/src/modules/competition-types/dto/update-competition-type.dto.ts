import { PartialType } from '@nestjs/mapped-types';
import { CreateCompetitionTypeDto } from './create-competition-type.dto';

export class UpdateCompetitionTypeDto extends PartialType(CreateCompetitionTypeDto) {}
