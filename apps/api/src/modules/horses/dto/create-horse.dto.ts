import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateHorseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string; // Relación con la tabla Owners

  @IsOptional()
  @IsString()
  feuId?: string;

  @IsOptional()
  @IsString()
  chipId?: string; 

  @IsOptional()
  @IsBoolean()
  isFeuActive?: boolean;
}
