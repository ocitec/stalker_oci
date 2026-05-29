import { IsString, IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FollowUpType } from '@prisma/client';

export class CreateFollowUpDto {
  @ApiProperty() @IsString()
  invoiceId: string;

  @ApiProperty({ enum: FollowUpType }) @IsEnum(FollowUpType)
  followUpType: FollowUpType;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  responseReceived?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  nextFollowUpDate?: string;
}
