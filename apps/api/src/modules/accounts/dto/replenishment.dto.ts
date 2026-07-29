import {
  IsString, IsOptional, IsNumber, IsPositive, IsInt, IsEnum, Min, Max, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ReplenishmentStatus } from '@prisma/client';

export class CreateReplenishmentDto {
  @ApiProperty() @IsString()
  operationalAccountId: string;

  @ApiProperty({ description: 'Amount requested to top up the account' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  requestedAmount: number;

  @ApiPropertyOptional({ description: 'Shortfall that triggered this request (defaults to requested amount)' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  requiredAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

export class ReplenishmentDecisionDto {
  @ApiPropertyOptional({ description: 'Approved top-up amount (defaults to requested amount)' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  approvedAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

export class ReplenishmentQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 }) @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ enum: ReplenishmentStatus }) @IsOptional() @IsEnum(ReplenishmentStatus)
  status?: ReplenishmentStatus;

  @ApiPropertyOptional() @IsOptional() @IsString()
  operationalAccountId?: string;
}
