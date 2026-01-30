import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RidersService } from './riders.service';
import { Rider } from './entities/rider.entity';

@Controller('riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Get()
  async getAllRiders() {
    return await this.ridersService.findAll();
  }

  @Get(':nationalId')
  async getByNationalId(@Param('nationalId') nationalId: string) {
    return await this.ridersService.findByNationalId(nationalId);
  }

  @Post()
  async createRider(@Body() riderData: Partial<Rider>) {
    return await this.ridersService.create(riderData);
  }
}
