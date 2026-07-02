import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("tenants")
export class Tenant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, unique: true })
  name: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  location: string;

  @Column({
    name: "federation_number",
    type: "integer",
    nullable: true,
    unique: true,
  })
  federationNumber: number;

  @Column({
    name: "jersey_image_url",
    type: "varchar",
    length: 550,
    nullable: true,
  })
  jerseyImageUrl: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
  createdAt: Date;
}
