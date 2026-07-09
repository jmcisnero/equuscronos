import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User } from "../users/entities/user.entity";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Obtener el usuario incluyendo explícitamente el hash de la contraseña
    const user = await this.userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.tenant", "tenant")
      .addSelect("user.passwordHash")
      .where("user.email = :email", { email })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Credenciales inválidas.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Credenciales inválidas.");
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant?.id || null,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant?.id || null,
        tenantName: user.tenant?.name || null,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name,
              location: user.tenant.location,
              federationNumber: user.tenant.federationNumber,
              jerseyImageUrl: user.tenant.jerseyImageUrl,
            }
          : null,
      },
    };
  }
}
