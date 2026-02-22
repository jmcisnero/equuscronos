import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { ParticipantStatus } from '@equuscronos/shared';
import { Competition } from './competition.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { Horse } from '../../horses/entities/horse.entity';
import { TimeRecord } from './time-record.entity';

@Entity('registrations')
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bib_number' })
  bibNumber: number; // El Dorsal único por competencia

  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.IN_RACE
  })
  status: ParticipantStatus;

  @Column({ name: 'ballast_weight', type: 'decimal', precision: 5, scale: 2, default: 0 })
  ballastWeight: number; // Lastre calculado

  @ManyToOne(() => Competition)
  competition: Competition;

  @ManyToOne(() => Rider)
  rider: Rider;

  @ManyToOne(() => Horse)
  horse: Horse;

  @OneToMany(() => TimeRecord, (record) => record.registration)
  timeRecords: TimeRecord[];
}
