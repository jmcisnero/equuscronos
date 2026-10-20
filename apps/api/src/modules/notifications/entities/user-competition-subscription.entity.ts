import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { UserDeviceToken } from "./user-device-token.entity";
import { Competition } from "../../competitions/entities/competition.entity";

@Entity("user_competition_subscriptions")
@Unique(["deviceTokenId", "competitionId"])
export class UserCompetitionSubscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId: string;

  @ManyToOne(() => UserDeviceToken, { onDelete: "CASCADE" })
  @JoinColumn({ name: "device_token_id" })
  deviceToken: UserDeviceToken;

  @Column({ name: "device_token_id", type: "uuid" })
  deviceTokenId: string;

  @ManyToOne(() => Competition, { onDelete: "CASCADE" })
  @JoinColumn({ name: "competition_id" })
  competition: Competition;

  @Column({ name: "competition_id", type: "uuid" })
  competitionId: string;

  @Column({ name: "notify_status_change", type: "boolean", default: true })
  notifyStatusChange: boolean;

  @Column({ name: "notify_stage_start", type: "boolean", default: true })
  notifyStageStart: boolean;

  @Column({ name: "notify_vet_gate", type: "boolean", default: true })
  notifyVetGate: boolean;

  @Column({ name: "notify_official_results", type: "boolean", default: true })
  notifyOfficialResults: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
  updatedAt: Date;
}
