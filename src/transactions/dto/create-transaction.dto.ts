import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  sourceUserId: string;
  destinationUserId: string;
  amount: string;
  assetId: string;
  reference: string;
  idempotencyKey?: string;
  type: TransactionType;
  metadata?: any;
}
