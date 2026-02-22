import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Unique, CreateDateColumn } from 'typeorm';
import { ParticipantStatus } from '@equuscronos/shared';
import { Competition } from './competition.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { Horse } from '../../horses/entities/horse.entity';
import { TimingRecord } from './timing-record.entity';

@Entity('competition_entries')
@Unique(['competition', 'bibNumber']) // Un dorsal no se repite por carrera
export class CompetitionEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bib_number', type: 'int' })
  bibNumber: number; // El Dorsal

  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.IN_RACE
  })
  status: ParticipantStatus;

  @Column({ name: 'ballast_weight', type: 'decimal', precision: 5, scale: 2, default: 0 })
  ballastWeight: number; // Lastre calculado basado en rider.currentWeight

  @ManyToOne(() => Competition, (comp) => comp.entries)
  competition: Competition;

  @ManyToOne(() => Rider)
  rider: Rider;

  @ManyToOne(() => Horse)
  horse: Horse;

  @OneToMany(() => TimingRecord, (record) => record.entry, { cascade: true })
  timingRecords: TimingRecord[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
