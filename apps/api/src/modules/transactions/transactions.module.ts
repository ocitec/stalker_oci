import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports:     [InvoicesModule],   // reuse InvoicesService for receivable generation/settlement
  controllers: [TransactionsController],
  providers:   [TransactionsService],
  exports:     [TransactionsService],
})
export class TransactionsModule {}
