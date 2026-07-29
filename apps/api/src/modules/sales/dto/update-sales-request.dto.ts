import { IsString, IsNumber, IsOptional, IsPositive, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateSalesRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional() @IsOptional()
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  requestedAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  currency?: string;
}

export class DecisionDto {
  @ApiPropertyOptional({ description: 'Reviewer comments' })
  @IsOptional() @IsString() @MaxLength(1000)
  comments?: string;
}
