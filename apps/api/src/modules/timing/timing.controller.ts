import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TimingService } from './timing.service';
import { CreateTimingRecordDto } from './dto/create-timing.dto';
// Asumiendo que creación de estos guards 
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { UserRole } from '@equuscronos/shared';

@Controller('timing')
// @UseGuards(JwtAuthGuard, RolesGuard) -> Descomentar cuando Auth esté listo
export class TimingController {
  constructor(private readonly timingService: TimingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // @Roles(UserRole.JUDGE, UserRole.VET, UserRole.ADMIN) -> Solo personal de campo
  async createRecord(@Body() createTimingDto: CreateTimingRecordDto) {
    return await this.timingService.processRapidFireRecord(createTimingDto);
  }
}
