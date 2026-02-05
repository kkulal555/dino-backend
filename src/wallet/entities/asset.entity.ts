import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('assets')
export class Asset {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ default: 0 })
  decimalPlaces: number;

  @CreateDateColumn()
  createdAt: Date;
}
