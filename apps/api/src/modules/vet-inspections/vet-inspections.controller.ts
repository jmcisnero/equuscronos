import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VetInspectionsService } from './vet-inspections.service';
import { CreateVetInspectionDto } from './dto/create-vet-inspection.dto';

@ApiTags('Clínica Veterinaria (Vet Inspections)')
@ApiBearerAuth('access-token')
@Controller('vet-inspections')
export class VetInspectionsController {
  constructor(private readonly vetInspectionsService: VetInspectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar formulario clínico veterinario' })
  create(@Body() createVetInspectionDto: CreateVetInspectionDto) {
    return this.vetInspectionsService.create(createVetInspectionDto);
  }
}
