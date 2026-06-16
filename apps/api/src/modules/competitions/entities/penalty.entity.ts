import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { CompetitionEntry } from "../../competition-entries/entities/competition-entry.entity";
import { Stage } from "./stage.entity";
import { Tenant } from "../../tenants/entities/tenant.entity";

@Entity("penalties")
export class Penalty {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Tenant, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @ManyToOne(() => CompetitionEntry, { onDelete: "CASCADE" })
  @JoinColumn({ name: "entry_id" })
  entry: CompetitionEntry;

  @ManyToOne(() => Stage, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "stage_id" })
  stage: Stage;

  @Column({ name: "time_penalty_seconds", type: "int" })
  timePenaltySeconds: number;

  @Column({ type: "varchar", length: 255 })
  reason: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
  createdAt: Date;
}
