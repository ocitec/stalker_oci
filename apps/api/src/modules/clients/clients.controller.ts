import {
  Controller, Get, Post, Put, Patch, Delete, Body,
  Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientQueryDto } from './dto/client-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('clients')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'clients', version: '1' })
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Create a new client' })
  create(@Body() dto: CreateClientDto, @CurrentUser('organizationId') orgId: string) {
    return this.clientsService.create(dto, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List all clients with filtering and pagination' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: ClientQueryDto) {
    return this.clientsService.findAll(orgId, query);
  }

  @Get('pdi-ranking')
  @ApiOperation({ summary: 'Get clients ranked by Payment Discipline Index' })
  getPdiRanking(@CurrentUser('organizationId') orgId: string) {
    return this.clientsService.getPdiRanking(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single client with invoice history' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.clientsService.findOne(id, orgId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Update client details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.clientsService.update(id, dto, orgId);
  }

  @Patch(':id/block')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Block a client from new credit (CFO/Admin only)' })
  block(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.clientsService.blockClient(id, reason, orgId);
  }

  @Patch(':id/unblock')
  @Roles(UserRole.ADMIN, UserRole.CFO)
  @ApiOperation({ summary: 'Unblock a client' })
  unblock(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.clientsService.unblockClient(id, orgId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a client (Admin only)' })
  remove(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.clientsService.remove(id, orgId);
  }
}
