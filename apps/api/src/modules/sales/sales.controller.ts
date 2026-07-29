import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SalesService } from './sales.service';
import { CreateSalesRequestDto } from './dto/create-sales-request.dto';
import { UpdateSalesRequestDto, DecisionDto } from './dto/update-sales-request.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('sales')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'sales-requests', version: '1' })
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE, UserRole.SALES)
  @ApiOperation({ summary: 'Create a sales request (DRAFT, or SUBMITTED when submit=true)' })
  create(
    @Body() dto: CreateSalesRequestDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.salesService.create(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List sales requests (paginated, filterable)' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: SalesQueryDto) {
    return this.salesService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single sales request with its downstream chain' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.salesService.findOne(id, orgId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE, UserRole.SALES)
  @ApiOperation({ summary: 'Edit a DRAFT sales request' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSalesRequestDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.salesService.update(id, dto, orgId, userId);
  }

  @Patch(':id/submit')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE, UserRole.SALES)
  @ApiOperation({ summary: 'Submit a DRAFT sales request for approval' })
  submit(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.salesService.submit(id, orgId, userId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Approve a submitted sales request' })
  approve(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.salesService.approve(id, orgId, userId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Reject a submitted sales request' })
  reject(
    @Param('id') id: string,
    @Body() dto: DecisionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.salesService.reject(id, dto, orgId, userId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE, UserRole.SALES)
  @ApiOperation({ summary: 'Cancel a DRAFT or SUBMITTED sales request' })
  cancel(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.salesService.cancel(id, orgId, userId);
  }
}
