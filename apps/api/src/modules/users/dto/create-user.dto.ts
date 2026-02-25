import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsUUID } from 'class-validator';
import { UserRole } from '@equuscronos/shared';

export class CreateUserDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  passwordHash?: string;

  @IsEnum(UserRole)
  role: UserRole;
}
