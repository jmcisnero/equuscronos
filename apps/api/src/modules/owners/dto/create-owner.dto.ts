import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { OwnerType } from '@equuscronos/shared';

export class CreateOwnerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(OwnerType)
  type: OwnerType;

  @IsOptional()
  @IsString()
  contactInfo?: string;
}
