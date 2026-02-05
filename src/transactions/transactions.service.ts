import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Transaction } from './entities/transaction.entity';
import { Posting } from './entities/posting.entity';
import { Account } from '../wallet/entities/account.entity';
import { Asset } from '../wallet/entities/asset.entity';
import Big from 'big.js';

@Injectable()
export class TransactionsService {
  constructor(private dataSource: DataSource) {}

  /**
   * Core transactional logic to transfer funds between two accounts.
   * Handles locking, idempotency, and ledger consistency.
   */
  async transferFunds(dto: CreateTransactionDto): Promise<Transaction> {
    const {
      sourceUserId,
      destinationUserId,
      amount,
      assetId,
      idempotencyKey,
      reference,
      type,
      metadata,
    } = dto;

    if (new Big(amount).lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    if (sourceUserId === destinationUserId) {
      throw new BadRequestException(
        'Source and Destination cannot be the same',
      );
    }

    const paramsString = JSON.stringify({
      sourceUserId,
      destinationUserId,
      amount,
      assetId,
    });

    const crypto = require('crypto');
    const paramsHash = crypto
      .createHash('sha256')
      .update(paramsString)
      .digest('hex');

    if (idempotencyKey) {
      const existing = await this.dataSource
        .getRepository(Transaction)
        .findOne({
          where: { idempotencyKey },
          relations: ['postings'],
        });
      if (existing) {
        if (existing.paramsHash && existing.paramsHash !== paramsHash) {
          throw new ConflictException(
            'Idempotency Key validation failed: Parameters mismatch',
          );
        }
        return existing;
      }
    }

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const isSystemSource = sourceUserId.startsWith('SYSTEM');
      const isSystemDest = destinationUserId.startsWith('SYSTEM');

      const accountsToLock: string[] = [];
      if (!isSystemSource) accountsToLock.push(sourceUserId);
      if (!isSystemDest) accountsToLock.push(destinationUserId);

      accountsToLock.sort();

      const asset = await manager.findOne(Asset, { where: { id: assetId } });
      if (!asset) throw new BadRequestException(`Asset ${assetId} not found`);

      let userAccounts: Account[] = [];
      if (accountsToLock.length > 0) {
        userAccounts = await manager.find(Account, {
          where: { userId: In(accountsToLock), assetId },
          lock: { mode: 'pessimistic_write' },
        });
      }

      const sysIds: string[] = [];
      if (isSystemSource) sysIds.push(sourceUserId);
      if (isSystemDest) sysIds.push(destinationUserId);

      let sysAccounts: Account[] = [];
      if (sysIds.length > 0) {
        sysAccounts = await manager.find(Account, {
          where: { userId: In(sysIds), assetId },
        });
        if (sysAccounts.length !== sysIds.length) {
          throw new BadRequestException('System account not found');
        }
      }

      const allAccounts = [...userAccounts, ...sysAccounts];
      const sourceAccount = allAccounts.find((a) => a.userId === sourceUserId);
      let destAccount = allAccounts.find((a) => a.userId === destinationUserId);

      if (!sourceAccount) {
        if (isSystemSource)
          throw new BadRequestException(
            `System Source ${sourceUserId} missing`,
          );
        throw new BadRequestException(
          'Insufficient funds (Account does not exist)',
        );
      }

      if (!destAccount) {
        if (isSystemDest)
          throw new BadRequestException(
            `System Destination ${destinationUserId} missing`,
          );

        const newAccount = manager.create(Account, {
          userId: destinationUserId,
          assetId: assetId,
          balance: '0.00',
        });
        destAccount = await manager.save(newAccount);
      }

      const transferAmount = new Big(amount);

      if (!isSystemSource) {
        const sourceBalance = new Big(sourceAccount.balance);
        if (sourceBalance.lt(transferAmount)) {
          throw new BadRequestException('Insufficient funds');
        }
      }

      const transaction = manager.create(Transaction, {
        reference,
        type,
        idempotencyKey,
        paramsHash,
        metadata,
      });
      await manager.save(transaction);

      const debitPosting = manager.create(Posting, {
        transaction,
        account: sourceAccount,
        asset: asset,
        amount: transferAmount.times(-1).toFixed(asset.decimalPlaces),
      });

      const creditPosting = manager.create(Posting, {
        transaction,
        account: destAccount,
        asset: asset,
        amount: transferAmount.toFixed(asset.decimalPlaces),
      });

      await manager.save([debitPosting, creditPosting]);

      if (!isSystemSource) {
        const newBal = new Big(sourceAccount.balance).minus(transferAmount);
        sourceAccount.balance = newBal.toFixed(asset.decimalPlaces);
        await manager.save(sourceAccount);
      } else {
        await manager.decrement(
          Account,
          { id: sourceAccount.id },
          'balance',
          Number(amount),
        );
      }

      if (!isSystemDest) {
        const newBal = new Big(destAccount.balance).plus(transferAmount);
        destAccount.balance = newBal.toFixed(asset.decimalPlaces);
        await manager.save(destAccount);
      } else {
        await manager.increment(
          Account,
          { id: destAccount.id },
          'balance',
          Number(amount),
        );
      }

      transaction.postings = [debitPosting, creditPosting];
      return transaction;
    });
  }

  async getLedger(
    userId: string,
    options: { assetId?: string; page?: number; limit?: number },
  ) {
    const { assetId, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    let currentBalance = new Big(0);
    if (assetId) {
      const acc = await this.dataSource
        .getRepository(Account)
        .findOne({ where: { userId, assetId } });
      if (acc) currentBalance = new Big(acc.balance);
    }

    const query = this.dataSource
      .getRepository(Posting)
      .createQueryBuilder('posting')
      .leftJoinAndSelect('posting.transaction', 'transaction')
      .leftJoinAndSelect('posting.asset', 'asset')
      .leftJoinAndSelect(
        'transaction.postings',
        'peer',
        'peer.id != posting.id',
      )
      .leftJoinAndSelect('peer.account', 'peerAccount')
      .innerJoin('posting.account', 'account', 'account.userId = :userId', {
        userId,
      })
      .orderBy('transaction.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (assetId) {
      query.andWhere('posting.assetId = :assetId', { assetId });
    }

    const [items, total] = await query.getManyAndCount();

    let startingBalanceForPage = currentBalance;

    if (assetId && skip > 0) {
      const newerSumResult = await this.dataSource
        .getRepository(Posting)
        .createQueryBuilder('posting')
        .select('SUM(posting.amount)', 'sum')
        .innerJoin('posting.account', 'account', 'account.userId = :userId', {
          userId,
        })
        .innerJoin('posting.transaction', 'transaction')

        .where('posting.assetId = :assetId', { assetId })
        .orderBy('transaction.createdAt', 'DESC')
        .take(skip)
        .getRawOne();

      const newerRows = await this.dataSource
        .getRepository(Posting)
        .createQueryBuilder('posting')
        .innerJoin('posting.account', 'account', 'account.userId = :userId', {
          userId,
        })
        .innerJoin('posting.transaction', 'transaction')
        .where('posting.assetId = :assetId', { assetId })
        .orderBy('transaction.createdAt', 'DESC')
        .take(skip)
        .getMany();

      const diff = newerRows.reduce(
        (acc, row) => acc.plus(new Big(row.amount)),
        new Big(0),
      );
      startingBalanceForPage = currentBalance.minus(diff);
    }

    let runningBalance = startingBalanceForPage;

    const mappedItems = items.map((p) => {
      const amount = new Big(p.amount);

      const closingBalance = runningBalance.toFixed(p.asset.decimalPlaces);
      const openingBalance = runningBalance
        .minus(amount)
        .toFixed(p.asset.decimalPlaces);

      runningBalance = runningBalance.minus(amount);

      const peer = p.transaction.postings.find((pp) => pp.id !== p.id);

      return {
        id: p.transaction.id,
        type: p.transaction.type,
        amount: p.amount,
        asset: p.asset.id,
        balance: {
          opening: assetId ? openingBalance : null,
          closing: assetId ? closingBalance : null,
        },
        counterparty: peer
          ? {
              userId: peer.account.userId,
              assetId: peer.assetId,
            }
          : 'System/External',
        reference: p.transaction.reference,
        createdAt: p.transaction.createdAt,
        metadata: p.transaction.metadata,
      };
    });

    return {
      userId,
      total,
      page,
      limit,
      items: mappedItems,
    };
  }
}
