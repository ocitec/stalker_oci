import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('alerts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'alerts', version: '1' })
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all alerts for the organization' })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('isRead') isRead?: string,
  ) {
    const readFilter = isRead !== undefined ? isRead === 'true' : undefined;
    return this.alertsService.findAll(orgId, readFilter);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread alert count' })
  getUnreadCount(@CurrentUser('organizationId') orgId: string) {
    return this.alertsService.getUnreadCount(orgId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single alert as read' })
  markRead(@Param('id') id: string) {
    return this.alertsService.markRead(id);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all alerts as read' })
  markAllRead(@CurrentUser('organizationId') orgId: string) {
    return this.alertsService.markAllRead(orgId);
  }
}
