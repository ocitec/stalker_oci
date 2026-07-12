import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService, ReportFilters } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private filters(q: any): ReportFilters {
    return {
      from:     q.from,
      to:       q.to,
      status:   q.status,
      clientId: q.clientId,
      userId:   q.userId,
    };
  }

  @Get('invoices')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  invoices(
    @CurrentUser('organizationId') orgId: string,
    @Query() q: any,
  ) {
    return this.reportsService.invoicesReport(orgId, this.filters(q));
  }

  @Get('collections')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  collections(
    @CurrentUser('organizationId') orgId: string,
    @Query() q: any,
  ) {
    return this.reportsService.collectionsReport(orgId, this.filters(q));
  }

  @Get('clients')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  clients(
    @CurrentUser('organizationId') orgId: string,
    @Query() q: any,
  ) {
    return this.reportsService.clientsReport(orgId, this.filters(q));
  }

  // ── CSV export endpoints ───────────────────────────────────────────────────
  @Get('invoices/export')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  async exportInvoices(
    @CurrentUser('organizationId') orgId: string,
    @Query() q: any,
    @Res() res: Response,
  ) {
    const rows = await this.reportsService.invoicesReport(orgId, this.filters(q));
    const csv  = this.reportsService.buildCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices-report.csv"');
    res.send(csv);
  }

  @Get('collections/export')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  async exportCollections(
    @CurrentUser('organizationId') orgId: string,
    @Query() q: any,
    @Res() res: Response,
  ) {
    const rows = await this.reportsService.collectionsReport(orgId, this.filters(q));
    const csv  = this.reportsService.buildCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="collections-report.csv"');
    res.send(csv);
  }

  @Get('clients/export')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  async exportClients(
    @CurrentUser('organizationId') orgId: string,
    @Query() q: any,
    @Res() res: Response,
  ) {
    const rows = await this.reportsService.clientsReport(orgId, this.filters(q));
    const csv  = this.reportsService.buildCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clients-report.csv"');
    res.send(csv);
  }
}
