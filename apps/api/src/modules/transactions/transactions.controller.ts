import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ApprovalActionDto, VerifyPaymentDto, FulfilmentDto } from './dto/transaction-actions.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('transactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Create a transaction from an APPROVED credit request' })
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.transactionsService.create(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List transactions (paginated, filterable)' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: TransactionQueryDto) {
    return this.transactionsService.findAll(orgId, query);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Transaction Control dashboard KPIs and drill-down lists' })
  dashboard(@CurrentUser('organizationId') orgId: string) {
    return this.transactionsService.getDashboard(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction with its full approval history' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.transactionsService.findOne(id, orgId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Edit a DRAFT transaction (recomputes margin + exposure)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transactionsService.update(id, dto, orgId, userId);
  }

  @Patch(':id/submit')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Submit a DRAFT transaction for multi-level review' })
  submit(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.transactionsService.submitForReview(id, orgId, userId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Approve the current approval level (role-gated by the ladder)' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.transactionsService.approve(id, dto, orgId, userId, role);
  }

  @Patch(':id/decline')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Decline a transaction under review' })
  decline(
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.transactionsService.decline(id, dto, orgId, userId, role);
  }

  @Patch(':id/hold')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Place a transaction under review on hold' })
  hold(
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.transactionsService.hold(id, dto, orgId, userId, role);
  }

  @Patch(':id/resume')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Return an on-hold transaction to review' })
  resume(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.transactionsService.resume(id, orgId, userId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Cancel a DRAFT / under-review / on-hold transaction' })
  cancel(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.transactionsService.cancel(id, orgId, userId);
  }

  @Patch(':id/verify-payment')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Record the client payment verification status' })
  verifyPayment(
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transactionsService.verifyPayment(id, dto, orgId, userId);
  }

  @Patch(':id/fulfilment')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Update service fulfilment status (APPROVED transactions only)' })
  fulfilment(
    @Param('id') id: string,
    @Body() dto: FulfilmentDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transactionsService.updateFulfilment(id, dto, orgId, userId);
  }
}
