import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-internal-token'];
    const expected = this.configService.get<string>('INTERNAL_API_TOKEN');

    if (!expected || token !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }

    return true;
  }
}
