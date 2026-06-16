import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";
import { CompetitionRules } from "../interfaces/competition-rules.interface";

@Entity("competition_types")
export class CompetitionType {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100, unique: true })
  name: string;

  @Column({ name: "default_rules", type: "jsonb", nullable: true })
  defaultRules: CompetitionRules;

  @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
  createdAt: Date;
}
