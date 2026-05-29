import {
  Controller, Get, Post, Patch, Body,
  Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('invoices')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Create a new invoice' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.create(dto, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List all invoices with filtering and pagination' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: InvoiceQueryDto) {
    return this.invoicesService.findAll(orgId, query);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Get all overdue invoices with follow-up gaps' })
  findOverdue(@CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.findOverdue(orgId);
  }

  @Get('aging')
  @ApiOperation({ summary: 'Get aging bucket breakdown' })
  getAging(@CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.getAgingReport(orgId);
  }

  @Get('dso')
  @ApiOperation({ summary: 'Calculate current Days Sales Outstanding' })
  getDso(@CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.calculateDSO(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single invoice with full history' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.invoicesService.findOne(id, orgId);
  }

  @Patch(':id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Mark invoice as paid and trigger PDI recalculation' })
  markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.invoicesService.markAsPaid(id, dto, orgId);
  }
}
