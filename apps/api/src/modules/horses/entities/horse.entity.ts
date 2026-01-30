import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Owner } from '../../owners/entities/owner.entity';

@Entity('horses')
export class Horse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'feu_id', unique: true, nullable: true })
  feuId: string;

  @Column({ name: 'chip_id', unique: true, nullable: true })
  chipId: string;

  @Column({ name: 'is_feu_active', default: false })
  isFeuActive: boolean;

  @ManyToOne(() => Owner, (owner) => owner.horses)
  @JoinColumn({ name: 'owner_id' })
  owner: Owner;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
