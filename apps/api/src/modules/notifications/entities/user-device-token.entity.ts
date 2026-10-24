import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("user_device_tokens")
export class UserDeviceToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId: string;

  @Column({ name: "device_token", type: "varchar", length: 500, unique: true })
  deviceToken: string;

  @Column({ type: "varchar", length: 20, default: "android" })
  platform: string; // 'ios' | 'android' | 'web'

  @Column({ name: "push_provider", type: "varchar", length: 20, default: "expo" })
  pushProvider: string; // 'expo' | 'fcm' | 'apns'

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
  updatedAt: Date;
}
