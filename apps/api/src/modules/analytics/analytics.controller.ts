import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('pdi-ranking')
  @ApiOperation({ summary: 'Full PDI ranking for all clients' })
  getPdiRanking(@CurrentUser('organizationId') orgId: string) {
    return this.analyticsService.getPdiRanking(orgId);
  }

  @Get('sector')
  @ApiOperation({ summary: 'Payment behaviour by sector' })
  getSectorAnalysis(@CurrentUser('organizationId') orgId: string) {
    return this.analyticsService.getSectorAnalysis(orgId);
  }

  @Get('dso-trend')
  @ApiOperation({ summary: 'DSO trend over 6 months' })
  getDsoTrend(@CurrentUser('organizationId') orgId: string) {
    return this.analyticsService.getDsoTrend(orgId);
  }

  @Get('predictive-risk')
  @ApiOperation({ summary: 'AI-powered late payment probability per client' })
  getPredictiveRisk(@CurrentUser('organizationId') orgId: string) {
    return this.analyticsService.getPredictiveRisk(orgId);
  }

  @Get('insights')
  @ApiOperation({ summary: 'AI-generated behavioral insights' })
  getInsights(@CurrentUser('organizationId') orgId: string) {
    return this.analyticsService.getAiInsights(orgId);
  }

  @Get('cfo-report')
  @ApiOperation({ summary: 'Weekly CFO summary report' })
  getCfoReport(@CurrentUser('organizationId') orgId: string) {
    return this.analyticsService.getCfoWeeklySummary(orgId);
  }
}
