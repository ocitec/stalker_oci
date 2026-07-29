import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ControlReportsService } from './control-reports.service';
import { ControlReportsController } from './control-reports.controller';

@Module({
  providers:   [ReportsService, ControlReportsService],
  controllers: [ReportsController, ControlReportsController],
})
export class ReportsModule {}
