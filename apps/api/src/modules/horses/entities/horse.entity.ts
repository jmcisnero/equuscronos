import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Owner } from '../../owners/entities/owner.entity';

@Entity('horses')
export class Horse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'feu_id', unique: true, nullable: true })
  feuId: string;
  
  @Column({ name: 'chip_id', unique: true, nullable: true })
  chipId: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date;
  
  @Column({ type: 'varchar', nullable: true })
  gender: string;
  
  @Column({ name: 'is_feu_active', default: false })
  isFeuActive: boolean;

  @ManyToOne(() => Owner, (owner) => owner.horses)
  @JoinColumn({ name: 'owner_id' })
  owner: Owner;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
