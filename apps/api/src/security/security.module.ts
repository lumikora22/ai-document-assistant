import { Module } from '@nestjs/common';
import { LlmRateLimitGuard, RateLimiter } from './rate-limit.guard';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  controllers: [SecurityController],
  providers: [SecurityService, RateLimiter, LlmRateLimitGuard],
  // RateLimiter é exportado para que o guard, usado em outros módulos, compartilhe o mesmo estado.
  exports: [SecurityService, RateLimiter, LlmRateLimitGuard],
})
export class SecurityModule {}
