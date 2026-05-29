import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { SlaModule } from '../sla/sla.module';

@Module({
  imports: [InvoicesModule, SlaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
