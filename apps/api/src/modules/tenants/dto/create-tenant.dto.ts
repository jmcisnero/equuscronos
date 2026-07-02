import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTenantDto {
  @ApiProperty({
    description: "Nombre de la institución (Ej: Sociedad Hípica de Melo)",
    example: "Sociedad Hípica de Melo",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: "Ubicación física, ciudad y departamento",
    example: "Melo, Cerro Largo",
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: "Número Oficial de Federación (FEU)",
    example: 123,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(999)
  federationNumber?: number;

  @ApiPropertyOptional({
    description: "URL pública de la Camiseta Oficial del Club",
    example: "https://example.com/jersey.jpg",
  })
  @IsOptional()
  @IsString()
  jerseyImageUrl?: string;
}
