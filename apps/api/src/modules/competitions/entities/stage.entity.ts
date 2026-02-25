import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Competition } from './competition.entity';

@Entity('stages')
@Unique(['competition', 'stageNumber']) // Mapea el UNIQUE(competition_id, stage_number)
export class Stage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Competition, (competition) => competition.stages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competition_id' })
  competition: Competition;

  @Column({ name: 'stage_number', type: 'int' })
  stageNumber: number;

  @Column({ name: 'distance_km', type: 'decimal', precision: 6, scale: 2 })
  distanceKm: number;

  @Column({ name: 'neutralization_minutes', type: 'int', default: 0 })
  neutralizationMinutes: number;
}
