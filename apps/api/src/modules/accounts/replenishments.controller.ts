import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AccountsService } from './accounts.service';
import {
  CreateReplenishmentDto, ReplenishmentDecisionDto, ReplenishmentQueryDto,
} from './dto/replenishment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('replenishments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'replenishments', version: '1' })
export class ReplenishmentsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Request a replenishment for an operational account' })
  create(@Body() dto: CreateReplenishmentDto, @CurrentUser('id') userId: string, @CurrentUser('organizationId') orgId: string) {
    return this.accountsService.createReplenishment(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List replenishment requests' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: ReplenishmentQueryDto) {
    return this.accountsService.findAllReplenishments(orgId, query);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Approve a replenishment request (CFO/Admin)' })
  approve(
    @Param('id') id: string,
    @Body() dto: ReplenishmentDecisionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.accountsService.approveReplenishment(id, dto, orgId, userId);
  }

  @Patch(':id/decline')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Decline a replenishment request (CFO/Admin)' })
  decline(
    @Param('id') id: string,
    @Body() dto: ReplenishmentDecisionDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.accountsService.declineReplenishment(id, dto, orgId, userId);
  }

  @Patch(':id/fund')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Fund an approved replenishment — credits the account balance' })
  fund(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.accountsService.fundReplenishment(id, orgId, userId);
  }
}
