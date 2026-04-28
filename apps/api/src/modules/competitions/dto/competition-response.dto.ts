import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CompStatus } from '@equuscronos/shared';

export class CompetitionResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  tenantId: string;

  @Expose()
  @ApiProperty()
  competitionTypeId: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  competitionDate: string;

  @Expose()
  @ApiProperty()
  location?: string;

  @Expose()
  @ApiProperty()
  isFederated: boolean;

  @Expose()
  @ApiProperty()
  maxHeartRate: number;

  @Expose()
  @ApiProperty({ enum: CompStatus })
  status: CompStatus;

  @Expose()
  @ApiProperty()
  stages: any[]; 

  @Expose()
  @ApiProperty()
  tenant: any;

  @Expose()
  @ApiProperty()
  competitionType: any;
}
