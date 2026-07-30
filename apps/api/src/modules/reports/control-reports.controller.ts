import {
  Controller, Get, Param, Query, Res, UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { ControlReportsService, ControlReportFilters } from './control-reports.service';
import { ExportService, ExportFormat, ReportPayload } from '../../common/services/export.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type ReportFn = (orgId: string, f: ControlReportFilters) => Promise<ReportPayload>;

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
@Controller({ path: 'reports/control', version: '1' })
export class ControlReportsController {
  private readonly reports: Record<string, ReportFn>;

  constructor(
    private readonly service: ControlReportsService,
    private readonly exporter: ExportService,
  ) {
    this.reports = {
      'transaction-register': (o, f) => this.service.transactionRegister(o, f),
      'exposure':             (o, f) => this.service.exposureReport(o, f),
      'approvals':            (o, f) => this.service.approvalReport(o, f),
      'supplier-cost':        (o, f) => this.service.supplierCostAnalysis(o, f),
      'payment-register':     (o, f) => this.service.paymentRegister(o, f),
      'outstanding-payments': (o, f) => this.service.outstandingPayments(o, f),
      'exceptions':           (o, f) => this.service.exceptionReport(o, f),
      'replenishments':       (o, f) => this.service.replenishmentReport(o, f),
    };
  }

  private filters(q: any): ControlReportFilters {
    return {
      from:       q.from,       to:         q.to,       clientId: q.clientId,
      supplierId: q.supplierId, status:     q.status,   approverId: q.approverId,
      accountId:  q.accountId,  currency:   q.currency, type:      q.type,
      department: q.department,
    };
  }

  private resolve(report: string): ReportFn {
    const fn = this.reports[report];
    if (!fn) {
      throw new NotFoundException(`Unknown report "${report}". Available: ${Object.keys(this.reports).join(', ')}`);
    }
    return fn;
  }

  @Get()
  @ApiOperation({ summary: 'List the available control-chain reports' })
  list() {
    return { reports: Object.keys(this.reports) };
  }

  @Get(':report')
  @ApiOperation({ summary: 'Get a control-chain report as JSON ({ title, columns, rows })' })
  @ApiParam({ name: 'report', enum: [
    'transaction-register', 'exposure', 'approvals', 'supplier-cost',
    'payment-register', 'outstanding-payments', 'exceptions', 'replenishments',
  ] })
  async json(
    @Param('report') report: string,
    @CurrentUser('organizationId') orgId: string,
    @Query() q: any,
  ) {
    return this.resolve(report)(orgId, this.filters(q));
  }

  @Get(':report/export')
  @ApiOperation({ summary: 'Export a control-chain report as csv | xlsx | pdf' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx', 'pdf'] })
  async export(
    @Param('report') report: string,
    @CurrentUser('organizationId') orgId: string,
    @Query() q: any,
    @Res() res: Response,
  ) {
    const format = (q.format ?? 'csv') as ExportFormat;
    const payload = await this.resolve(report)(orgId, this.filters(q));

    let body: string | Buffer;
    if (format === 'csv')       body = this.exporter.csv(payload);
    else if (format === 'xlsx') body = await this.exporter.xlsx(payload);
    else if (format === 'pdf')  body = await this.exporter.pdf(payload);
    else throw new BadRequestException(`Unsupported format "${format}". Use csv, xlsx or pdf.`);

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', this.exporter.contentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="${report}-${date}.${format}"`);
    res.send(body);
  }
}
