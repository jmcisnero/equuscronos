import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { CompetitionStatus } from '@equuscronos/shared';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { CompetitionType } from '../../competition-types/entities/competition-type.entity';
import { Stage } from './stage.entity';
import { CompetitionEntry } from '../../competition-entries/entities/competition-entry.entity';

@Entity('competitions')
export class Competition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => CompetitionType)
  @JoinColumn({ name: 'competition_type_id' })
  competitionType: CompetitionType;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'competition_date', type: 'date' })
  competitionDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ name: 'is_federated', type: 'boolean', default: false })
  isFederated: boolean;

  @Column({ type: 'int', default: 65, name: 'max_heart_rate' })
  maxHeartRate: number;
  
  @Column({ type: 'enum', enum: CompetitionStatus, default: CompetitionStatus.PLANNED }) 
  status: CompetitionStatus;
  
  // Relaciones inversas útiles
  @OneToMany(() => Stage, (stage) => stage.competition)
  stages: Stage[];

  @OneToMany(() => CompetitionEntry, (entry) => entry.competition)
  entries: CompetitionEntry[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
