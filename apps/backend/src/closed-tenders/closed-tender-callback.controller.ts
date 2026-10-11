import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ClosedTenderCallbackService } from './closed-tender-callback.service';
import { ClosedTenderCallbackDto } from './dto/closed-tender-callback.dto';
import { InternalTokenGuard } from '../common/guards/internal-token.guard';

@Controller('internal')
@UseGuards(InternalTokenGuard)
export class ClosedTenderCallbackController {
  constructor(private callbackService: ClosedTenderCallbackService) {}

  @Post('closed-tender-callback')
  handleCallback(@Body() dto: ClosedTenderCallbackDto) {
    return this.callbackService.handleCallback(dto);
  }
}
