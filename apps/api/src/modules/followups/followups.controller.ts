import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FollowUpsService } from './followups.service';
import { CreateFollowUpDto } from './dto/create-followup.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('followups')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'followups', version: '1' })
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Post()
  @ApiOperation({ summary: 'Log a follow-up action on an invoice' })
  create(
    @Body() dto: CreateFollowUpDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.followUpsService.create(dto, userId, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List follow-ups, optionally filtered by invoice' })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.followUpsService.findAll(orgId, invoiceId);
  }

  @Get('compliance')
  @ApiOperation({ summary: 'Get follow-up compliance metrics' })
  getCompliance(@CurrentUser('organizationId') orgId: string) {
    return this.followUpsService.getFollowUpCompliance(orgId);
  }
}
