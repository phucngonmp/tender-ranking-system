import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InternalService } from './internal.service';
import { CrawlCallbackDto } from './dto/crawl-callback.dto';
import { InternalTokenGuard } from '../common/guards/internal-token.guard';

import { IsOptional, IsString, IsArray } from 'class-validator';

class MuasamcongTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsArray()
  cookies?: Record<string, string>[];
}

@Controller('internal')
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(private internalService: InternalService) {}

  @Post('crawl-callback')
  handleCallback(@Body() dto: CrawlCallbackDto) {
    return this.internalService.handleCrawlCallback(dto);
  }

  /**
   * Called by the Python crawler worker to push the latest MuaSamCong
   * session token so the BE can use it for the backup HSMT download flow.
   */
  @Post('token/muasamcong')
  setToken(@Body() dto: MuasamcongTokenDto) {
    this.internalService.setMuasamcongToken(dto.token, dto.cookies ?? []);
    return { ok: true };
  }

  /**
   * Allows any internal service to check whether a token is currently cached.
   */
  @Get('token/muasamcong')
  getTokenStatus() {
    const { token } = this.internalService.getMuasamcongToken();
    return { hasToken: !!token };
  }
}
