import {
  Controller, Get, Post, Patch, Body,
  Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InvoicesService }   from './invoices.service';
import { CreateInvoiceDto }  from './dto/create-invoice.dto';
import { InvoiceQueryDto }   from './dto/invoice-query.dto';
import { MarkPaidDto }       from './dto/mark-paid.dto';
import { RevertPaymentDto }  from './dto/revert-payment.dto';
import { JwtAuthGuard }      from '../../common/guards/jwt-auth.guard';
import { RolesGuard }        from '../../common/guards/roles.guard';
import { Roles }             from '../../common/decorators/roles.decorator';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';

@ApiTags('invoices')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Create a new invoice' })
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.invoicesService.create(dto, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices with filtering and pagination' })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: InvoiceQueryDto,
  ) {
    return this.invoicesService.findAll(orgId, query);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'All overdue and partially-paid invoices' })
  findOverdue(@CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.findOverdue(orgId);
  }

  @Get('aging')
  @ApiOperation({ summary: 'Aging bucket breakdown (uses remaining balance for partial payments)' })
  getAging(@CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.getAgingReport(orgId);
  }

  @Get('dso')
  @ApiOperation({ summary: 'Current Days Sales Outstanding' })
  getDso(@CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.calculateDSO(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Single invoice with full payment history' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.invoicesService.findOne(id, orgId);
  }

  // ── Mark paid: full or partial payment ────────────────────────────────────
  @Patch(':id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({
    summary: 'Record a payment (full or partial)',
    description:
      'Omit paymentAmount to pay the full remaining balance. ' +
      'Supply paymentAmount < remaining balance to record a partial payment ' +
      'and set status to PARTIALLY_PAID.',
  })
  markPaid(
    @Param('id')                        id:     string,
    @Body()                             dto:    MarkPaidDto,
    @CurrentUser('organizationId')      orgId:  string,
    @CurrentUser('sub')                 userId: string,
  ) {
    return this.invoicesService.markAsPaid(id, dto, orgId, userId);
  }

  // ── Revert most recent payment ─────────────────────────────────────────────
  @Patch(':id/revert-payment')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({
    summary: 'Revert the most recent payment on an invoice (CFO/ADMIN only)',
    description:
      'Only the most recent non-reverted payment can be reverted. ' +
      'The PaymentRecord is soft-deleted (isReverted = true) so the audit trail is preserved.',
  })
  revertPayment(
    @Param('id')                        id:     string,
    @Body()                             dto:    RevertPaymentDto,
    @CurrentUser('organizationId')      orgId:  string,
    @CurrentUser('sub')                 userId: string,
  ) {
    return this.invoicesService.revertPayment(id, dto, orgId, userId);
  }
}