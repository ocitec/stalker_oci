import {
  IsString, IsNumber, IsOptional, IsPositive,
  IsBoolean, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSalesRequestDto {
  @ApiProperty() @IsString()
  clientId: string;

  @ApiProperty({ example: 'Supply of 200 network routers' })
  @IsString() @MaxLength(200)
  title: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 750000 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  requestedAmount: number;

  @ApiPropertyOptional({ default: 'NGN' }) @IsOptional() @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Override the auto-generated reference' })
  @IsOptional() @IsString() @MaxLength(40)
  reference?: string;

  @ApiPropertyOptional({ description: 'Submit immediately instead of saving as DRAFT', default: false })
  @IsOptional() @IsBoolean()
  submit?: boolean;
}
