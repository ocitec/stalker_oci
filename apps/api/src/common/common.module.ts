import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { ExposureService } from './services/exposure.service';
import { ExportService } from './services/export.service';

/**
 * Global cross-cutting infrastructure shared by every feature module
 * (mirrors PrismaModule). Exposes the audit writer, the credit-exposure
 * calculator, and the CSV/XLSX/PDF exporter without each module re-declaring them.
 */
@Global()
@Module({
  providers: [AuditService, ExposureService, ExportService],
  exports:   [AuditService, ExposureService, ExportService],
})
export class CommonModule {}
