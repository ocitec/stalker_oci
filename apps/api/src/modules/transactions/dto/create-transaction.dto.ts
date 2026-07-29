import {
  IsString, IsNumber, IsOptional, IsPositive, IsBoolean, Min, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTransactionDto {
  @ApiProperty({ description: 'Must reference an APPROVED credit request' })
  @IsString()
  creditRequestId: string;

  @ApiProperty({ example: 750000 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  newTransactionValue: number;

  @ApiPropertyOptional({ example: 600000, description: 'Cost payable to the supplier' })
  @IsOptional()
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  supplierCost?: number;

  @ApiPropertyOptional({ default: 'NGN' }) @IsOptional() @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'SRF number — auto-generated if omitted (unique)' })
  @IsOptional() @IsString() @MaxLength(40)
  srfNumber?: string;

  @ApiPropertyOptional({ description: 'Override the auto-generated transaction reference' })
  @IsOptional() @IsString() @MaxLength(40)
  reference?: string;

  @ApiPropertyOptional({ description: 'Expected client payment source (bank, cheque, etc.)' })
  @IsOptional() @IsString() @MaxLength(120)
  paymentSource?: string;

  @ApiPropertyOptional({ description: 'Submit for review immediately instead of saving as DRAFT', default: false })
  @IsOptional() @IsBoolean()
  submit?: boolean;
}
