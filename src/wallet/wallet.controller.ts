import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { BasicAuthGuard } from '../common/guards/basic-auth.guard';

@Controller('wallet')
@UseGuards(BasicAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get(':userId/balance')
  async getBalance(
    @Param('userId') userId: string,
    @Query('assetId') assetId?: string,
  ) {
    return this.walletService.getBalance(userId, assetId);
  }
}
