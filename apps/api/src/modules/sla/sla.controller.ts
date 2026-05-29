import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SlaService } from './sla.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('sla')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'sla', version: '1' })
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('violations')
  @ApiOperation({ summary: 'Get all SLA violations' })
  getViolations(
    @CurrentUser('organizationId') orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.slaService.getViolations(orgId, page, limit);
  }

  @Get('top-violators')
  @ApiOperation({ summary: 'Get top SLA violators by frequency' })
  getTopViolators(@CurrentUser('organizationId') orgId: string) {
    return this.slaService.getTopViolators(orgId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get SLA violation summary stats' })
  getSummary(@CurrentUser('organizationId') orgId: string) {
    return this.slaService.getSummary(orgId);
  }
}
