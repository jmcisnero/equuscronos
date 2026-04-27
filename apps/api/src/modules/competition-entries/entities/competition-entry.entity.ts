import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, OneToMany } from 'typeorm';
import { ParticipantStatus } from '@equuscronos/shared';
import { Competition } from '../../competitions/entities/competition.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { Horse } from '../../horses/entities/horse.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Stage } from '../../competitions/entities/stage.entity';
import { TimingRecord } from '../../competitions/entities/timing-record.entity';

@Entity('competition_entries')
@Unique(['competition', 'bibNumber'])
export class CompetitionEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Competition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competition_id' })
  competition: Competition;

  @ManyToOne(() => Rider, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rider_id' })
  rider: Rider;

  @ManyToOne(() => Horse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'horse_id' })
  horse: Horse;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'represented_tenant_id' })
  representedTenant: Tenant;

  @Column({ name: 'bib_number', type: 'int' })
  bibNumber: number;

  @Column({ type: 'enum', enum: ParticipantStatus, default: ParticipantStatus.IN_RACE })
  status: ParticipantStatus;

  @Column({ name: 'qualifies_for_points', type: 'boolean', default: false })
  qualifiesForPoints: boolean;

  @Column({ name: 'final_position', type: 'int', nullable: true })
  finalPosition: number;

  // Único peso estático permitido (Lastre)
  @Column({ name: 'ballast_weight', type: 'decimal', precision: 5, scale: 2, default: 0.00 })
  ballastWeight: number;

  @ManyToOne(() => Stage, { nullable: true })
  @JoinColumn({ name: 'current_stage_id' })
  currentStage: Stage;

  @OneToMany(() => TimingRecord, (record) => record.entry)
  timingRecords: TimingRecord[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
