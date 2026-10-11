import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './types/authenticated-user';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const tokens = await this.issueTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role.name,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
      },
    };
  }

  async changePassword(userId: string, dto: import('./dto/change-password.dto').ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Incorrect current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true };
  }

  async refresh(rawRefreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const matches = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer active');
    }

    const accessToken = await this.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role.name,
    });

    return { accessToken };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<{ jti: string }>(rawRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti },
        data: { revoked: true },
      });
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }

  private async signAccessToken(user: AuthenticatedUser): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.userId, email: user.email, role: user.role },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );
  }

  private async issueTokenPair(user: AuthenticatedUser): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(user);

    const jti = randomUUID();
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.userId, jti },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + this.parseDurationMs(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.userId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private parseDurationMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const value = parseInt(match[1], 10);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ?? 86_400_000;
    return value * unitMs;
  }
}
