import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { HorsesService } from './horses.service';
import { Horse } from './entities/horse.entity';

@Controller('horses')
export class HorsesController {
  constructor(private readonly horsesService: HorsesService) {}

  @Get()
  async getAllHorses() {
    return await this.horsesService.findAll();
  }

  @Get('chip/:id')
  async getByChip(@Param('id') id: string) {
    return await this.horsesService.findByChip(id);
  }

  @Post()
  async createHorse(@Body() horseData: Partial<Horse>) {
    return await this.horsesService.create(horseData);
  }
}
