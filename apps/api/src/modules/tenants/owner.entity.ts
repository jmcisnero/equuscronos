import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { OwnerType } from '@equuscronos/shared';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: OwnerType, default: OwnerType.PERSON })
  type: OwnerType;

  @Column({ name: 'contact_info', type: 'varchar', length: 255, nullable: true })
  contactInfo: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
