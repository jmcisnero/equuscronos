import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Owner } from '../../owners/entities/owner.entity';

@Entity('horses')
export class Horse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Owner, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: Owner;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'feu_id', type: 'varchar', length: 50, unique: true, nullable: true })
  feuId: string;

  @Column({ name: 'chip_id', type: 'varchar', length: 100, unique: true, nullable: true })
  chipId: string;

  @Column({ name: 'is_feu_active', type: 'boolean', default: false })
  isFeuActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
