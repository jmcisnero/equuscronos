import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CompetitionEntry } from '../../competition-entries/entities/competition-entry.entity';
import { Stage } from '../../competitions/entities/stage.entity';
import { User } from '../../users/entities/user.entity';

@Entity('weight_controls')
export class WeightControl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CompetitionEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: CompetitionEntry;

  @ManyToOne(() => Stage, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @Column({ name: 'weight_recorded', type: 'decimal', precision: 5, scale: 2 })
  weightRecorded: number;

  @Column({ name: 'control_type', type: 'varchar', length: 50 })
  controlType: string; // 'INITIAL', 'NEUTRALIZATION', 'ARRIVAL'

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recorded_by' })
  recordedBy: User;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamp with time zone' })
  recordedAt: Date;
}
