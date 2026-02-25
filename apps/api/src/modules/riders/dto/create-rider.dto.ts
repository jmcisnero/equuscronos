import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateRiderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  nationalId: string; // CI o DNI

  @IsOptional()
  @IsString()
  feuId?: string;

  @IsOptional()
  @IsBoolean()
  isFeuActive?: boolean;
}
