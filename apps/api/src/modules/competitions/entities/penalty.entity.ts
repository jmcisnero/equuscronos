import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CompetitionEntry } from './competition-entry.entity';
import { Stage } from './stage.entity';

@Entity('penalties')
export class Penalty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CompetitionEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: CompetitionEntry;

  @ManyToOne(() => Stage, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @Column({ name: 'time_penalty_seconds', type: 'int' })
  timePenaltySeconds: number;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
