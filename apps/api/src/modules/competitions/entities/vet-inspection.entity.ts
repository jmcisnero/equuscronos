import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { ClinicalStatus, MotricityStatus } from '@equuscronos/shared';
import { TimingRecord } from './timing-record.entity';

@Entity('vet_inspections')
export class VetInspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => TimingRecord, (record) => record.vetInspection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timing_record_id' })
  timingRecord: TimingRecord;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number;

  @Column({ type: 'enum', enum: MotricityStatus, default: MotricityStatus.APTO })
  motricity: MotricityStatus;

  @Column({ type: 'enum', enum: ClinicalStatus, default: ClinicalStatus.NORMAL })
  metabolic: ClinicalStatus;

  @Column({ name: 'attempt_number', type: 'int', default: 1 })
  attemptNumber: number;

  @Column({ name: 'is_recheck_required', type: 'boolean', default: false })
  isRecheckRequired: boolean;

  @Column({ name: 'next_check_time', type: 'timestamp with time zone', nullable: true })
  nextCheckTime: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
