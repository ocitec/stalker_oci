import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto, SupplierQueryDto } from './dto/supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('suppliers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'suppliers', version: '1' })
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Create a supplier' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser('id') userId: string, @CurrentUser('organizationId') orgId: string) {
    return this.suppliersService.create(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List suppliers' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: SupplierQueryDto) {
    return this.suppliersService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a supplier' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.suppliersService.findOne(id, orgId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
  @ApiOperation({ summary: 'Update a supplier (incl. activate/deactivate)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.suppliersService.update(id, dto, orgId, userId);
  }
}
