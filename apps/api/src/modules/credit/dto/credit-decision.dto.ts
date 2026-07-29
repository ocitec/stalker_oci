import { IsString, IsNumber, IsOptional, IsPositive, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreditDecisionDto {
  @ApiPropertyOptional({ description: 'Approved credit amount (defaults to requested amount on approval)' })
  @IsOptional()
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  approvedAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  comments?: string;
}
