import { IsString, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MergeClientsDto {
  @ApiProperty({ description: 'The client that survives the merge and receives all records' })
  @IsString()
  survivorId: string;

  @ApiProperty({ type: [String], description: 'Duplicate client ids to merge into the survivor and delete' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  duplicateIds: string[];
}
