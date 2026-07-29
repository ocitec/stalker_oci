import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { ReplenishmentsController } from './replenishments.controller';
import { AccountsService } from './accounts.service';

@Module({
  controllers: [AccountsController, ReplenishmentsController],
  providers:   [AccountsService],
  exports:     [AccountsService],
})
export class AccountsModule {}
