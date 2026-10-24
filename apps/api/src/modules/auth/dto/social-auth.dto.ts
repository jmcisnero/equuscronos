import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEmail } from "class-validator";

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  googleId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  identityToken?: string;

  @IsBoolean()
  @IsOptional()
  optInMarketing?: boolean;
}

export class AppleAuthDto {
  @IsString()
  @IsNotEmpty()
  appleId: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  identityToken?: string;

  @IsBoolean()
  @IsOptional()
  optInMarketing?: boolean;
}

export class GuestAuthDto {
  @IsString()
  @IsOptional()
  deviceToken?: string;

  @IsBoolean()
  @IsOptional()
  optInMarketing?: boolean;
}

export class LinkGuestDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceToken: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  optInMarketing?: boolean;
}
