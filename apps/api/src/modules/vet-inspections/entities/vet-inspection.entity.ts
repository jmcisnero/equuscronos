import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { GaitStatus, InspectionType } from "@equuscronos/shared";
import { Tenant } from "../../tenants/entities/tenant.entity";
import { Competition } from "../../competitions/entities/competition.entity";

@Entity("vet_inspections")
export class VetInspection {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Tenant, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @ManyToOne(() => Competition, { onDelete: "CASCADE" })
  @JoinColumn({ name: "competence_id" })
  competition: Competition;

  @Column({ name: "vet_gate_number", type: "int" })
  vetGateNumber: number;

  @Column({ name: "rider_dorsal", type: "varchar", length: 50 })
  riderDorsal: string;

  @Column({ name: "arrival_time", type: "timestamp with time zone" })
  arrivalTime: Date;

  @Column({ name: "vet_in_time", type: "timestamp with time zone" })
  vetInTime: Date;

  @Column({ name: "heart_rate", type: "int" })
  heartRate: number;

  @Column({
    name: "gait_status",
    type: "enum",
    enum: GaitStatus,
    default: GaitStatus.APPROVED,
  })
  gaitStatus: GaitStatus;

  @Column({
    name: "inspection_type",
    type: "enum",
    enum: InspectionType,
    default: InspectionType.STANDARD,
  })
  inspectionType: InspectionType;

  @Column({ name: "requires_recheck", type: "boolean", default: false })
  requiresRecheck: boolean;

  @Column({ name: "attempt_number", type: "int", default: 1 })
  attemptNumber: number;

  @Column({ name: "is_recheck_required", type: "boolean", default: false })
  isRecheckRequired: boolean;

  @Column({
    name: "next_check_time",
    type: "timestamp with time zone",
    nullable: true,
  })
  nextCheckTime?: Date | null;

  @Column({ name: "is_final_decision", type: "boolean", default: true })
  isFinalDecision: boolean;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
  createdAt: Date;
}
