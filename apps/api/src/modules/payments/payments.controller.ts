import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentRequestDto, ApprovePaymentDto, ProcessPaymentDto,
  ConfirmPaymentDto, FailPaymentDto, PaymentQueryDto,
} from './dto/payment-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('payment-requests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'payment-requests', version: '1' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Raise a payment request for an APPROVED transaction' })
  create(@Body() dto: CreatePaymentRequestDto, @CurrentUser('id') userId: string, @CurrentUser('organizationId') orgId: string) {
    return this.paymentsService.create(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List payment requests (paginated, filterable)' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(orgId, query);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Payment Control dashboard KPIs and drill-down lists' })
  dashboard(@CurrentUser('organizationId') orgId: string) {
    return this.paymentsService.getDashboard(orgId);
  }

  @Get('exceptions')
  @ApiOperation({ summary: 'List payment exceptions' })
  exceptions(@CurrentUser('organizationId') orgId: string, @Query('status') status?: string) {
    return this.paymentsService.listExceptions(orgId, status);
  }

  @Patch('exceptions/:id/resolve')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Resolve a payment exception' })
  resolveException(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.paymentsService.resolveException(id, orgId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payment request with exceptions and links' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.paymentsService.findOne(id, orgId);
  }

  @Patch(':id/submit')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Submit a draft payment request for approval' })
  submit(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.paymentsService.submit(id, orgId, userId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Approve a payment request (balance verified; CFO/Admin)' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApprovePaymentDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.approve(id, dto, orgId, userId);
  }

  @Patch(':id/process')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Disburse an approved payment — debits the operational account' })
  process(
    @Param('id') id: string,
    @Body() dto: ProcessPaymentDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.process(id, dto, orgId, userId);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Confirm a processed payment cleared' })
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.confirm(id, dto, orgId, userId);
  }

  @Patch(':id/fail')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Mark a processing payment as failed — reverses the debit' })
  fail(
    @Param('id') id: string,
    @Body() dto: FailPaymentDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.fail(id, dto, orgId, userId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Cancel a payment request before disbursement' })
  cancel(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.paymentsService.cancel(id, orgId, userId);
  }
}
