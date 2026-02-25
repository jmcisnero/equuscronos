import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('riders')
export class Rider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'national_id', type: 'varchar', length: 50, unique: true })
  nationalId: string;

  @Column({ name: 'feu_id', type: 'varchar', length: 50, unique: true, nullable: true })
  feuId: string;

  @Column({ name: 'is_feu_active', type: 'boolean', default: false })
  isFeuActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
