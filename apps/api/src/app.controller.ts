import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHome() {
    return { message: 'Backend is running successfully' };
  }

  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
