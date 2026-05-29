import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    ClientsModule,
    BullModule.registerQueue({ name: 'alerts' }),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
