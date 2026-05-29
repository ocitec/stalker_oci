import {
  IsString, IsNumber, IsOptional, IsDateString,
  IsPositive, IsEnum, IsInt, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export class CreateInvoiceDto {
  @ApiProperty() @IsString()
  clientId: string;

  @ApiProperty({ example: 'INV-2025-0001' }) @IsString()
  invoiceNumber: string;

  @ApiProperty({ example: 150000 }) @IsNumber() @IsPositive() @Type(() => Number)
  invoiceAmount: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({ description: 'Defaults to client SLA days if not provided' })
  @IsOptional() @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ default: 'NGN' }) @IsOptional() @IsString()
  currency?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;
}

export class InvoiceQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: InvoiceStatus }) @IsOptional() @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional() @IsOptional() @IsString()
  clientId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateTo?: string;
}

export class MarkPaidDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  paidDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @IsPositive() @Type(() => Number)
  paidAmount?: number;
}
