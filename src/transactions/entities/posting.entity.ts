import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { Account } from '../../wallet/entities/account.entity';
import { Asset } from '../../wallet/entities/asset.entity';

@Entity('postings')
export class Posting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  transactionId: string;

  @ManyToOne(() => Transaction, (trx) => trx.postings)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  @Index()
  accountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column()
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'assetId' })
  asset: Asset;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  amount: string;
}
