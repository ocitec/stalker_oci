import {
  IsString, IsOptional, IsNumber, IsPositive, IsDateString,
  IsEnum, IsInt, Min, Max, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class PreviewReceiptDto {
  @ApiProperty() @IsString()
  clientId: string;

  @ApiProperty({ example: 35000000, description: 'Total payment received from the client' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  amount: number;
}

export class CreateReceiptDto {
  @ApiProperty() @IsString()
  clientId: string;

  @ApiProperty({ example: 35000000 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Defaults to today' })
  @IsOptional() @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional() @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Bank/cheque/transfer reference' })
  @IsOptional() @IsString() @MaxLength(120)
  paymentReference?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class ReceiptQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString()
  clientId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;
}
