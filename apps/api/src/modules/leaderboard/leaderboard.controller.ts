import { Controller, Get, Param, ParseUUIDPipe, UseInterceptors, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardEntryDto } from './dto/leaderboard-response.dto';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Espectadores: Leaderboard')
@Controller('competitions/:competitionId/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener tabla de posiciones FEU (Optimizada para Polling)' })
  @ApiResponse({ status: 200, type: [LeaderboardEntryDto] })
  @Header('Cache-Control', 'public, max-age=15') // Escudo de CDN (Cloudflare)
  @UseInterceptors(CacheInterceptor)             // Escudo de RAM (NestJS)
  @CacheTTL(15000) 
  async getLeaderboard(
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
  ): Promise<LeaderboardEntryDto[]> {
    return await this.leaderboardService.getLiveLeaderboard(competitionId);
  }
}
