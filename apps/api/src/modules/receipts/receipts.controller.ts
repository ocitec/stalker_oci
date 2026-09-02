import {
  Controller, Get, Post, Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReceiptsService } from './receipts.service';
import { PreviewReceiptDto, CreateReceiptDto, ReceiptQueryDto } from './dto/receipt.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('receipts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CFO, UserRole.FINANCE)
@Controller({ path: 'receipts', version: '1' })
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get('outstanding')
  @ApiQuery({ name: 'clientId', required: true })
  @ApiOperation({ summary: "View a client's outstanding invoices (oldest first) with total outstanding" })
  outstanding(@Query('clientId') clientId: string, @CurrentUser('organizationId') orgId: string) {
    if (!clientId) throw new BadRequestException('clientId is required');
    return this.receiptsService.getOutstanding(clientId, orgId);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Consolidate/calculate the proposed allocation without persisting (review step)' })
  preview(@Body() dto: PreviewReceiptDto, @CurrentUser('organizationId') orgId: string) {
    return this.receiptsService.preview(dto, orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Record a receipt and atomically allocate it across outstanding invoices' })
  create(
    @Body() dto: CreateReceiptDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.receiptsService.create(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List receipts (paginated, filterable)' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: ReceiptQueryDto) {
    return this.receiptsService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a receipt with its full invoice allocation breakdown' })
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.receiptsService.findOne(id, orgId);
  }
}
