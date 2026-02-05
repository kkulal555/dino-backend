import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionType } from './entities/transaction.entity';
import { SystemAccounts } from '../config/system-accounts.config';
import { BasicAuthGuard } from '../common/guards/basic-auth.guard';

@Controller('transactions')
@UseGuards(BasicAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('ledger/:userId')
  async getLedger(
    @Param('userId') userId: string,
    @Query('assetId') assetId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.transactionsService.getLedger(userId, {
      assetId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post('topup')
  async topup(
    @Body()
    body: {
      userId: string;
      amount: string;
      assetId: string;
      reference: string;
    },
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.transactionsService.transferFunds({
      sourceUserId: SystemAccounts.TREASURY,
      destinationUserId: body.userId,
      amount: body.amount,
      assetId: body.assetId,
      reference: body.reference,
      type: TransactionType.TOPUP,
      idempotencyKey,
    });
  }

  @Post('bonus')
  async bonus(
    @Body()
    body: {
      userId: string;
      amount: string;
      assetId: string;
      reference: string;
      reason: string;
    },
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.transactionsService.transferFunds({
      sourceUserId: SystemAccounts.MARKETING,
      destinationUserId: body.userId,
      amount: body.amount,
      assetId: body.assetId,
      reference: body.reference,
      type: TransactionType.BONUS,
      idempotencyKey,
      metadata: { reason: body.reason },
    });
  }

  @Post('spend')
  async spend(
    @Body()
    body: {
      userId: string;
      amount: string;
      assetId: string;
      reference: string;
      itemId: string;
    },
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.transactionsService.transferFunds({
      sourceUserId: body.userId,
      destinationUserId: SystemAccounts.REVENUE,
      amount: body.amount,
      assetId: body.assetId,
      reference: body.reference,
      type: TransactionType.SPEND,
      idempotencyKey,
      metadata: { itemId: body.itemId },
    });
  }
}
