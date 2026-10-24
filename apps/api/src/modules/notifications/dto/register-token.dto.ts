import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator";

export class RegisterTokenDto {
  @IsString()
  @IsNotEmpty()
  deviceToken: string;

  @IsString()
  @IsOptional()
  platform?: string; // 'ios' | 'android' | 'web'

  @IsString()
  @IsOptional()
  pushProvider?: string; // 'expo' | 'fcm'

  @IsString()
  @IsOptional()
  userId?: string;
}
