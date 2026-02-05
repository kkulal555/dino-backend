import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Account)
    private accountRepo: Repository<Account>,
  ) {}

  async getBalance(userId: string, assetId?: string): Promise<any> {
    if (assetId) {
      const account = await this.accountRepo.findOne({
        where: { userId, assetId },
      });
      return {
        asset: assetId,
        balance: account ? account.balance : '0.00',
      };
    } else {
      const accounts = await this.accountRepo.find({
        where: { userId },
        relations: ['asset'],
      });
      return accounts.map((acc) => ({
        asset: acc.assetId,
        balance: acc.balance,
      }));
    }
  }
}
