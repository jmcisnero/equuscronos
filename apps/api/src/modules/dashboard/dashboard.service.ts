import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { Horse } from '../horses/entities/horse.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Owner } from '../owners/entities/owner.entity';
import { Competition } from '../competitions/entities/competition.entity';
import { CompetitionStatus } from '@equuscronos/shared';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Horse)
    private readonly horseRepository: Repository<Horse>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
    @InjectRepository(Competition)
    private readonly competitionRepository: Repository<Competition>,
  ) {}

  /**
   * Obtiene métricas en tiempo real y estadísticas del padrón nacional FEU
   * para alimentar la consola del Dashboard Central de EquusCronos.
   */
  async getStats() {
    const todayStr = new Date().toISOString().split('T')[0];

    const [
      totalHorses,
      totalRiders,
      totalOwners,
      activeHorses,
      activeRiders,
      expiredHealthHorses,
      expiringHorses,
      activeCompetition,
      upcomingCompetitions,
    ] = await Promise.all([
      this.horseRepository.count(),
      this.riderRepository.count(),
      this.ownerRepository.count(),
      this.horseRepository.count({ where: { isFeuActive: true } }),
      this.riderRepository.count({ where: { isFeuActive: true } }),
      this.horseRepository.count({
        where: {
          healthRecordsExpiration: LessThan(todayStr as any),
        },
      }),
      this.horseRepository.find({
        where: {
          healthRecordsExpiration: Not(IsNull()),
        },
        order: {
          healthRecordsExpiration: 'ASC',
        },
        take: 3,
      }),
      this.competitionRepository.findOne({
        where: { status: CompetitionStatus.ACTIVE },
        relations: ['competitionType'],
      }),
      this.competitionRepository.find({
        order: { competitionDate: 'DESC' },
        relations: ['competitionType'],
        take: 5,
      }),
    ]);

    return {
      totalHorses,
      totalRiders,
      totalOwners,
      activeHorses,
      activeRiders,
      expiredHealthHorses,
      expiringHorses,
      activeCompetition,
      upcomingCompetitions,
    };
  }
}
