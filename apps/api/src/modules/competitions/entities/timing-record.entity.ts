import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { TimeRecordType } from '@equuscronos/shared';
import { CompetitionEntry } from './competition-entry.entity';

@Entity('timing_records')
export class TimingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stage_order', type: 'int' })
  stageOrder: number;

  @Column({ name: 'record_type', type: 'enum', enum: TimeRecordType })
  recordType: TimeRecordType;

  @Column({ name: 'recorded_at', type: 'timestamp' })
  recordedAt: Date; // Hora exacta del evento hípico

  @Column({ name: 'heart_rate', type: 'int', nullable: true })
  heartRate: number; // Null si no es VET_IN

  @Column({ name: 'is_approved', type: 'boolean', default: true })
  isApproved: boolean; // Resultado de la inspección vet

  @Column({ name: 'elimination_reason', nullable: true })
  eliminationReason: string; // "Cojera", "Metabolismo", etc.

  @ManyToOne(() => CompetitionEntry, (entry) => entry.timingRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: CompetitionEntry;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
