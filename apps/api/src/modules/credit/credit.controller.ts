import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreditService } from './credit.service';
import { CreateCreditRequestDto } from './dto/create-credit-request.dto';
import { CreditDecisionDto } from './dto/credit-decision.dto';
import { CreditQueryDto } from './dto/credit-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('credit')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'credit-requests', version: '1' })
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Open a credit assessment for an APPROVED sales request' })
  create(
    @Body() dto: CreateCreditRequestDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.creditService.create(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List credit requests (paginated, filterable)' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: CreditQueryDto) {
    return this.creditService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a credit request with live client exposure' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.creditService.findOne(id, orgId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Approve a credit request (CFO/Admin)' })
  approve(
    @Param('id') id: string,
    @Body() dto: CreditDecisionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.creditService.approve(id, dto, orgId, userId);
  }

  @Patch(':id/decline')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Decline a credit request (CFO/Admin)' })
  decline(
    @Param('id') id: string,
    @Body() dto: CreditDecisionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.creditService.decline(id, dto, orgId, userId);
  }

  @Patch(':id/hold')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Place a credit request on hold (CFO/Admin)' })
  hold(
    @Param('id') id: string,
    @Body() dto: CreditDecisionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.creditService.hold(id, dto, orgId, userId);
  }
}
