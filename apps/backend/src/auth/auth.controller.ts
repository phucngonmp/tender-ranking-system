import { Body, Controller, Get, HttpCode, HttpStatus, Post, Patch, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: currentUser.userId },
      include: { role: true },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      isActive: user.isActive,
    };
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: import('./dto/change-password.dto').ChangePasswordDto,
  ) {
    return this.authService.changePassword(currentUser.userId, dto);
  }
}
