import {
  IsOptional,
  IsNumber,
  IsPositive,
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MarkPaidDto {
  /**
   * Amount to record for this payment.
   * Omit to pay the full remaining balance (full payment).
   * Must be greater than zero and not exceed the current remaining balance.
   */
  @ApiPropertyOptional({ example: 250000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  paymentAmount?: number;

  /**
   * Date the payment was received. Defaults to today if omitted.
   */
  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  /**
   * Internal note about this payment (reference number, bank name, etc.).
   */
  @ApiPropertyOptional({ example: 'Bank transfer — ref TXN-20260601', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}