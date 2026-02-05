import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Asset } from './asset.entity';

@Entity('accounts')
@Unique(['userId', 'assetId'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'assetId' })
  asset: Asset;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  balance: string;

  @CreateDateColumn()
  createdAt: Date;
}
