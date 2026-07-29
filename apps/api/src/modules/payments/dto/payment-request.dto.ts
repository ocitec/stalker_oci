import {
  IsString, IsOptional, IsNumber, IsPositive, IsDateString, IsEnum, IsInt, Min, Max, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentRequestStatus, PaymentMethod } from '@prisma/client';

export class CreatePaymentRequestDto {
  @ApiProperty({ description: 'Must reference an APPROVED transaction' })
  @IsString()
  transactionId: string;

  @ApiProperty() @IsString()
  supplierId: string;

  @ApiProperty({ description: 'Operational account to disburse from' })
  @IsString()
  operationalAccountId: string;

  @ApiPropertyOptional({ description: 'Defaults to the transaction supplier cost' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  requestedAmount?: number;

  @ApiPropertyOptional({ default: 'NGN' }) @IsOptional() @IsString()
  currency?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dueDate?: string;
}

export class ApprovePaymentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  comments?: string;
}

export class ProcessPaymentDto {
  @ApiPropertyOptional({ description: 'Amount actually disbursed (defaults to requested amount)' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  paymentAmount?: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Bank/transfer reference for the disbursement' })
  @IsOptional() @IsString() @MaxLength(120)
  confirmationReference?: string;
}

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Confirmation reference proving the payment cleared' })
  @IsString() @MaxLength(120)
  confirmationReference: string;
}

export class FailPaymentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  reason?: string;
}

export class PaymentQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: PaymentRequestStatus }) @IsOptional() @IsEnum(PaymentRequestStatus)
  status?: PaymentRequestStatus;

  @ApiPropertyOptional() @IsOptional() @IsString()
  supplierId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  transactionId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;
}
