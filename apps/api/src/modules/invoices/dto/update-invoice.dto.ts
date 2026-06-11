import {
  IsString, IsNumber, IsOptional, IsDateString,
  IsPositive,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ example: 'INV-2025-0001' })
  @IsOptional() @IsString()
  invoiceNumber?: string;

  /**
   * Only allowed when invoice is still PENDING (no payments recorded).
   * Also recalculates remainingBalance.
   */
  @ApiPropertyOptional({ example: 200000 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Type(() => Number)
  invoiceAmount?: number;

  /** Only allowed when invoice is PENDING. */
  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ default: 'NGN' })
  @IsOptional() @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
