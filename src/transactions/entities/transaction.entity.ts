import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Posting } from './posting.entity';

export enum TransactionType {
  TOPUP = 'TOPUP',
  SPEND = 'SPEND',
  BONUS = 'BONUS',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  reference: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({ nullable: true })
  @Index({ unique: true, where: '"idempotencyKey" IS NOT NULL' })
  idempotencyKey: string;

  @Column({ nullable: true })
  paramsHash: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Posting, (posting: Posting) => posting.transaction, {
    cascade: true,
  })
  postings: Posting[];
}
