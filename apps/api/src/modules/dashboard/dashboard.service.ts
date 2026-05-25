import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Horse } from '../horses/entities/horse.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Owner } from '../owners/entities/owner.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Horse)
    private readonly horseRepository: Repository<Horse>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
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
    ]);

    return {
      totalHorses,
      totalRiders,
      totalOwners,
      activeHorses,
      activeRiders,
      expiredHealthHorses,
    };
  }
}
