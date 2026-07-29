import {
  IsString, IsNumber, IsOptional, IsPositive, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCreditRequestDto {
  @ApiProperty({ description: 'Must reference an APPROVED sales request' })
  @IsString()
  salesRequestId: string;

  @ApiPropertyOptional({ description: 'Defaults to the sales request amount when omitted' })
  @IsOptional()
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  requestedAmount?: number;

  @ApiPropertyOptional({ default: 'NGN' }) @IsOptional() @IsString()
  currency?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  reference?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  comments?: string;
}
