import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';
import { Asset } from './src/wallet/entities/asset.entity';
import { Account } from './src/wallet/entities/account.entity';
import { Transaction, TransactionType } from './src/transactions/entities/transaction.entity';
import { Posting } from './src/transactions/entities/posting.entity';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);
    const assetRepo = dataSource.getRepository(Asset);
    const accountRepo = dataSource.getRepository(Account);
    const trxRepo = dataSource.getRepository(Transaction);
    console.log('Cleaning DB...');
    await trxRepo.query('TRUNCATE TABLE postings, transactions, accounts, assets CASCADE');
    console.log('Seeding Assets...');
    const gold = await assetRepo.save(assetRepo.create({ id: 'GOLD', name: 'Gold Coins', decimalPlaces: 2 }));
    const points = await assetRepo.save(assetRepo.create({ id: 'POINTS', name: 'Loyalty Points', decimalPlaces: 0 }));
    console.log('Seeding System Accounts...');
    const treasury = await accountRepo.save(accountRepo.create({ userId: 'SYSTEM_TREASURY', asset: gold, balance: '1000000.00' }));
    const marketing = await accountRepo.save(accountRepo.create({ userId: 'SYSTEM_MARKETING', asset: points, balance: '1000000.00' }));
    const revenue = await accountRepo.save(accountRepo.create({ userId: 'SYSTEM_REVENUE', asset: gold, balance: '0.00' }));
    console.log('Seeding Users...');
    const user1Id = 'u1';
    const user2Id = 'u2';
    const user1 = await accountRepo.save(accountRepo.create({ userId: user1Id, asset: gold, balance: '100.00' }));
    const user1Points = await accountRepo.save(accountRepo.create({ userId: user1Id, asset: points, balance: '0.00' }));
    const user2 = await accountRepo.save(accountRepo.create({ userId: user2Id, asset: gold, balance: '50.00' }));
    console.log('Seeding Initial Transactions (Ledger Consistency)...');
    const trx1 = trxRepo.create({
        type: TransactionType.BONUS,
        reference: 'TRANSFER_OF_100_GOLD',
        postings: [
            { account: treasury, asset: gold, amount: '-100.00', transactionId: '' } as any,
            { account: user1, asset: gold, amount: '100.00', transactionId: '' } as any
        ]
    });
    await trxRepo.save(trx1);
    const initTrx = trxRepo.create({
        type: TransactionType.TOPUP,
        reference: 'INITIALIZATION_ENTRY',
        postings: [
            { account: treasury, asset: gold, amount: '1000000.00', transactionId: '' } as any,
        ]
    });
    const voidAccount = await accountRepo.save(accountRepo.create({ userId: 'VOID', asset: gold, balance: '-1000000.00' }));
    initTrx.postings.push({ account: voidAccount, asset: gold, amount: '-1000000.00', transactionId: '' } as any);
    await trxRepo.save(initTrx);
    const trx2 = trxRepo.create({
        type: TransactionType.BONUS,
        reference: 'SEED_INIT_2',
        postings: [
            { account: treasury, asset: gold, amount: '-50.00' } as any,
            { account: user2, asset: gold, amount: '50.00' } as any
        ]
    });
    await trxRepo.save(trx2);
    console.log('Seeding Complete!');
    await app.close();
}

bootstrap();
