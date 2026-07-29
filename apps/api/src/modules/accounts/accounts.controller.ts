import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto, AccountQueryDto } from './dto/account.dto';
import {
  CreateReplenishmentDto, ReplenishmentDecisionDto, ReplenishmentQueryDto,
} from './dto/replenishment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('operational-accounts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'operational-accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  // ── Accounts ──
  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Create an operational (disbursement) account' })
  create(@Body() dto: CreateAccountDto, @CurrentUser('id') userId: string, @CurrentUser('organizationId') orgId: string) {
    return this.accountsService.createAccount(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List operational accounts with balances' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: AccountQueryDto) {
    return this.accountsService.findAllAccounts(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an operational account with recent replenishments' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.accountsService.findOneAccount(id, orgId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Update account name / minimum balance / active flag' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.accountsService.updateAccount(id, dto, orgId, userId);
  }
}
