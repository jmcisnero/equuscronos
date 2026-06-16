import { PartialType } from "@nestjs/swagger";
import { CreateCompetitionDto } from "./create-competition.dto";

/**
 * Hereda todas las validaciones de CreateCompetitionDto.
 * Permite actualizaciones parciales (PATCH) manteniendo la integridad de los datos.
 */
export class UpdateCompetitionDto extends PartialType(CreateCompetitionDto) {}
