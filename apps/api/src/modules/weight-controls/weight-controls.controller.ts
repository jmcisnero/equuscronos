import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WeightControlsService } from './weight-controls.service';
import { CreateWeightControlDto } from './dto/create-weight-control.dto';

@ApiTags('Balanza Oficial (Weight Controls)')
@ApiBearerAuth('access-token')
@Controller('admin/weight-controls')
export class WeightControlsController {
  constructor(private readonly weightControlsService: WeightControlsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar peso en balanza oficial' })
  create(@Body() createWeightControlDto: CreateWeightControlDto) {
    return this.weightControlsService.create(createWeightControlDto);
  }
}
