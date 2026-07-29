import { IsOptional, IsInt, IsString, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreditRequestStatus } from '@prisma/client';

export class CreditQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: CreditRequestStatus }) @IsOptional() @IsEnum(CreditRequestStatus)
  status?: CreditRequestStatus;

  @ApiPropertyOptional() @IsOptional() @IsString()
  clientId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;
}
