// ─────────────────────────────────────────────────────────────────────────────
// apps/api/src/modules/invoices/dto/revert-payment.dto.ts
// ─────────────────────────────────────────────────────────────────────────────
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RevertPaymentDto {
  @ApiProperty({
    description:
      'ID of the PaymentRecord to revert. ' +
      'Only the most recent non-reverted payment on the invoice can be reverted.',
    example: 'clxk2j3ab0000r5v4k8j9d3fg',
  })
  @IsString()
  @IsNotEmpty()
  paymentRecordId: string;

  @ApiPropertyOptional({
    description: 'Reason for reverting the payment (stored in audit log).',
    example: 'Entered wrong amount — client confirmed bank transfer not received',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}