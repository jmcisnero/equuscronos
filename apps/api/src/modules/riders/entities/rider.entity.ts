import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('riders')
export class Rider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'national_id', unique: true })
  nationalId: string; // La Cédula de Identidad

  @Column({ name: 'feu_id', unique: true, nullable: true })
  feuId: string; // El carnet de la Federación

  @Column({ name: 'is_feu_active', default: false })
  isFeuActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
