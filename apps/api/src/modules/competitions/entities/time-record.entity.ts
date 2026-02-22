import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { TimeRecordType } from '@equuscronos/shared';
import { Registration } from './registration.entity';

@Entity('time_records')
export class TimeRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  stageOrder: number; // A qué etapa pertenece el registro

  @Column({ type: 'enum', enum: TimeRecordType })
  type: TimeRecordType;

  @Column({ type: 'timestamp' })
  recordedAt: Date; // Hora exacta del evento

  @Column({ name: 'heart_rate', type: 'int', nullable: true })
  heartRate: number; // Solo se llena en VET_IN

  @Column({ name: 'is_vet_approved', type: 'boolean', default: true })
  isVetApproved: boolean;

  @Column({ name: 'elimination_reason', nullable: true })
  eliminationReason: string; // Ej: "Cojera", "Metabólico"

  @ManyToOne(() => Registration, (reg) => reg.timeRecords)
  registration: Registration;

  @CreateDateColumn()
  createdAt: Date;
}
