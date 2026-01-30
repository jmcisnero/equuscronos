import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('riders')
export class Rider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'national_id', unique: true })
  nationalId: string; // Cédula de Identidad (CI)

  @Column({ name: 'feu_id', unique: true, nullable: true })
  feuId: string; // Carnet de la Federación Ecuestre Uruguaya

  @Column({ name: 'is_feu_active', default: false })
  isFeuActive: boolean;

  @Column({ name: 'current_weight', type: 'decimal', precision: 5, scale: 2, default: 0 })
  currentWeight: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date; // Para auditoría de cambios de peso o estatus
}
