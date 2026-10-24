import { Injectable, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User } from "../users/entities/user.entity";
import { UserRole } from "@equuscronos/shared";
import { LoginDto } from "./dto/login.dto";
import {
  GoogleAuthDto,
  AppleAuthDto,
  GuestAuthDto,
  UpdateProfileDto,
} from "./dto/social-auth.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

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

    return this.generateUserTokenResponse(user);
  }

  async googleAuth(dto: GoogleAuthDto) {
    let user = await this.userRepository.findOne({
      where: [{ googleId: dto.googleId }, { email: dto.email }],
    });

    if (!user) {
      user = this.userRepository.create({
        googleId: dto.googleId,
        email: dto.email,
        name: dto.name || dto.email.split("@")[0],
        role: UserRole.SPECTATOR,
        optInMarketing: dto.optInMarketing ?? true,
        isGuest: false,
      });
    } else {
      user.googleId = dto.googleId;
      if (dto.name) user.name = dto.name;
      if (dto.optInMarketing !== undefined) user.optInMarketing = dto.optInMarketing;
      user.isGuest = false;
    }

    user = await this.userRepository.save(user);
    return this.generateUserTokenResponse(user);
  }

  async appleAuth(dto: AppleAuthDto) {
    const email = dto.email || `apple_${dto.appleId}@privaterelay.appleid.com`;
    let user = await this.userRepository.findOne({
      where: [{ appleId: dto.appleId }, { email }],
    });

    if (!user) {
      user = this.userRepository.create({
        appleId: dto.appleId,
        email,
        name: dto.name || "Usuario Apple",
        role: UserRole.SPECTATOR,
        optInMarketing: dto.optInMarketing ?? true,
        isGuest: false,
      });
    } else {
      user.appleId = dto.appleId;
      if (dto.name) user.name = dto.name;
      if (dto.optInMarketing !== undefined) user.optInMarketing = dto.optInMarketing;
      user.isGuest = false;
    }

    user = await this.userRepository.save(user);
    return this.generateUserTokenResponse(user);
  }

  async guestAuth(dto: GuestAuthDto) {
    const guestId = Math.random().toString(36).substring(2, 10);
    const guestEmail = `guest_${guestId}@guest.equuscronos.com`;

    let user = this.userRepository.create({
      name: `Invitado ${guestId}`,
      email: guestEmail,
      role: UserRole.SPECTATOR,
      isGuest: true,
      optInMarketing: dto.optInMarketing ?? false,
    });

    user = await this.userRepository.save(user);
    return this.generateUserTokenResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado.");
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.optInMarketing !== undefined) user.optInMarketing = dto.optInMarketing;

    const updated = await this.userRepository.save(user);
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      optInMarketing: updated.optInMarketing,
      isGuest: updated.isGuest,
      role: updated.role,
    };
  }

  private generateUserTokenResponse(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant?.id || null,
      isGuest: user.isGuest,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isGuest: user.isGuest,
        optInMarketing: user.optInMarketing,
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
