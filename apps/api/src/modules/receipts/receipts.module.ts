import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports:     [ClientsModule],   // reuse ClientsService.recalculatePDI after allocation
  controllers: [ReceiptsController],
  providers:   [ReceiptsService],
  exports:     [ReceiptsService],
})
export class ReceiptsModule {}
