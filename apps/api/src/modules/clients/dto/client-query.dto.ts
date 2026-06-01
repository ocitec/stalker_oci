import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { ClientRisk } from '@prisma/client';

export class ClientQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 200 })
  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number)
  limit?: number = 200;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ClientRisk })
  @IsOptional() @IsEnum(ClientRisk)
  riskStatus?: ClientRisk;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isBlocked?: boolean;
}
