import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CFO)
  findAll(@CurrentUser('organizationId') orgId: string) {
    return this.usersService.findAll(orgId);
  }

  @Post('invite')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Invite a new team member (Admin only)' })
  invite(
    @Body() body: { name: string; email: string; role: string; department?: string },
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.invite(body, orgId);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Change user role (Admin only)' })
  updateRole(
    @Param('id') id: string,
    @Body('role') role: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.updateRole(id, role, orgId);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.usersService.deactivate(id, orgId);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  activate(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.usersService.activate(id, orgId);
  }

  // ── Profile (own user — no role restriction) ──────────────────────────────
  @Get('me/profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me/profile')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() body: { name?: string; email?: string; department?: string },
  ) {
    return this.usersService.updateProfile(userId, body);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(userId, body.currentPassword, body.newPassword);
  }

  @Get('me/activity')
  getActivity(
    @CurrentUser('id') userId: string,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page:  number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.usersService.getActivity(userId, page, limit);
  }
}
