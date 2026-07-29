import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentVerificationStatus, FulfilmentStatus } from '@prisma/client';

/** Comment payload shared by approve / decline / hold actions. */
export class ApprovalActionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  comments?: string;
}

export class VerifyPaymentDto {
  @ApiPropertyOptional({ enum: PaymentVerificationStatus })
  @IsEnum(PaymentVerificationStatus)
  clientPaymentStatus: PaymentVerificationStatus;

  @ApiPropertyOptional({ description: 'Explicit verified flag; defaults to true only for VERIFIED status' })
  @IsOptional() @IsBoolean()
  paymentVerified?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  paymentSource?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  paymentDate?: string;
}

export class FulfilmentDto {
  @ApiPropertyOptional({ enum: FulfilmentStatus })
  @IsEnum(FulfilmentStatus)
  fulfilmentStatus: FulfilmentStatus;
}
