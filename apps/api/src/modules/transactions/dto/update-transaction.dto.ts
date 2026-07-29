import { IsString, IsNumber, IsOptional, IsPositive, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateTransactionDto {
  @ApiPropertyOptional() @IsOptional()
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  newTransactionValue?: number;

  @ApiPropertyOptional() @IsOptional()
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  supplierCost?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  srfNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  paymentSource?: string;
}
