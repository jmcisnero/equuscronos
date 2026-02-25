import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { TimeRecordType, EliminationCode } from '@equuscronos/shared';
import { CompetitionEntry } from './competition-entry.entity';
import { Stage } from './stage.entity';
import { VetInspection } from './vet-inspection.entity';

@Entity('timing_records')
export class TimingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CompetitionEntry, (entry) => entry.timingRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: CompetitionEntry;

  @ManyToOne(() => Stage, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @Column({ name: 'record_type', type: 'enum', enum: TimeRecordType })
  recordType: TimeRecordType;

  @Column({ name: 'recorded_at', type: 'timestamp with time zone' })
  recordedAt: Date;

  @Column({ name: 'heart_rate', type: 'int', nullable: true })
  heartRate: number;

  @Column({ name: 'is_approved', type: 'boolean', default: true })
  isApproved: boolean;

  @Column({ name: 'elimination_type', type: 'enum', enum: EliminationCode, nullable: true })
  eliminationType: EliminationCode;

  @Column({ name: 'elimination_reason', type: 'text', nullable: true })
  eliminationReason: string;

  @Column({ name: 'scheduled_departure_time', type: 'timestamp with time zone', nullable: true })
  scheduledDepartureTime: Date;

  // --- Auditoría ---
  @Column({ name: 'is_void', type: 'boolean', default: false })
  isVoid: boolean;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string;

  // --- Relación 1:1 con la Clínica Veterinaria ---
  @OneToOne(() => VetInspection, (vet) => vet.timingRecord)
  vetInspection: VetInspection;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
