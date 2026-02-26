import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@equuscronos/shared';

export class CreateUserDto {
  @ApiPropertyOptional({ description: 'UUID del Club al que pertenece. Dejar nulo si es SuperAdministrador global.' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ description: 'Nombre completo del operador', example: 'Carlos Juez' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Correo electrónico de acceso', example: 'juez@melo.uy' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Contraseña plana (el sistema aplicará el hash bcrypt)', example: 'Equus2026!' })
  @IsOptional()
  @IsString()
  passwordHash?: string;

  @ApiProperty({ description: 'Nivel de privilegios y accesos del sistema', enum: UserRole, example: UserRole.JUDGE })
  @IsEnum(UserRole)
  role: UserRole;
}
