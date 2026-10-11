import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../types/authenticated-user';

interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
