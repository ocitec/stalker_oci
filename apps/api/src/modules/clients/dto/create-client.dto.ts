import {
  IsString, IsOptional, IsEmail, IsNumber,
  IsEnum, Min, IsBoolean, IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateClientDto {
  @ApiProperty({ example: 'MTN Nigeria Plc' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'RC-123456' })
  @IsOptional() @IsString()
  companyRegistration?: string;

  @ApiPropertyOptional({ example: 'finance@mtn.ng' })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+2341234567890' })
  @IsOptional() @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Telecommunications' })
  @IsOptional() @IsString()
  sector?: string;

  @ApiProperty({ example: 500000 })
  @IsNumber() @IsPositive()
  @Type(() => Number)
  creditLimit: number;

  @ApiProperty({ example: 30, description: 'Payment SLA in days' })
  @IsNumber() @Min(1)
  @Type(() => Number)
  slaDays: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}
