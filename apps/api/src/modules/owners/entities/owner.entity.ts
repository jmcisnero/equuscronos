import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Horse } from '../../horses/entities/horse.entity';

export enum OwnerType {
  PERSON = 'PERSON',
  STUD = 'STUD',
  HARAS = 'HARAS',
}

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: OwnerType,
    default: OwnerType.PERSON,
  })
  type: OwnerType;

  @Column({ name: 'contact_info', nullable: true })
  contactInfo: string;

  @OneToMany(() => Horse, (horse) => horse.owner)
  horses: Horse[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
