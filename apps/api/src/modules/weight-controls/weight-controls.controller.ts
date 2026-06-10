import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WeightControlsService } from './weight-controls.service';
import { CreateWeightControlDto } from './dto/create-weight-control.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@equuscronos/shared';

@ApiTags('Balanza Oficial (Weight Controls)')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN, UserRole.JUDGE)
@Controller('admin/weight-controls')
export class WeightControlsController {
  constructor(private readonly weightControlsService: WeightControlsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar peso en balanza oficial' })
  create(@Body() createWeightControlDto: CreateWeightControlDto) {
    return this.weightControlsService.create(createWeightControlDto);
  }
}
