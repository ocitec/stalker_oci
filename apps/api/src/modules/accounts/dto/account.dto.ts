import {
  IsString, IsOptional, IsNumber, IsBoolean, Min, IsInt, Max, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateAccountDto {
  @ApiProperty() @IsString() @MaxLength(120)
  name: string;

  @ApiProperty() @IsString() @MaxLength(40)
  accountNumber: string;

  @ApiProperty() @IsString() @MaxLength(120)
  bankName: string;

  @ApiPropertyOptional({ default: 'NGN' }) @IsOptional() @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 0, description: 'Opening balance' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  currentBalance?: number;

  @ApiPropertyOptional({ default: 0, description: 'Replenishment triggers below this balance' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  minimumBalance?: number;
}

export class UpdateAccountDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  minimumBalance?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class AccountQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 }) @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  isActive?: boolean;
}
