import {
  IsString, IsOptional, IsEmail, IsBoolean, IsInt, Min, Max, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateSupplierDto {
  @ApiProperty() @IsString() @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Unique supplier code' })
  @IsOptional() @IsString() @MaxLength(40)
  code?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  bankName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  bankAccountNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  bankAccountName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  code?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  bankName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  bankAccountNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  bankAccountName?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

export class SupplierQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 }) @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional() @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  isActive?: boolean;
}
