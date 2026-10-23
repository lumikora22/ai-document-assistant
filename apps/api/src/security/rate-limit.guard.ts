import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SecurityService } from './security.service';

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT_PER_MINUTE = 20;

/**
 * Janela deslizante em memória, por IP. Basta para uma instância; com várias
 * réplicas o estado teria que ir para um Redis.
 */
@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  /** Quando a última recusa de cada chave foi registrada. */
  private readonly deniedAt = new Map<string, number>();

  /** Registra a tentativa e diz se ela cabe no limite. `firstDenial` é true só na primeira recusa da janela. */
  take(key: string, limit: number, now = Date.now()): { allowed: boolean; firstDenial: boolean; retryAfterMs: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    this.hits.set(key, recent);
    if (recent.length >= limit) {
      const last = this.deniedAt.get(key);
      const firstDenial = last === undefined || now - last >= WINDOW_MS;
      if (firstDenial) this.deniedAt.set(key, now);
      return { allowed: false, firstDenial, retryAfterMs: WINDOW_MS - (now - recent[0]) };
    }
    recent.push(now);
    this.prune(now);
    return { allowed: true, firstDenial: false, retryAfterMs: 0 };
  }

  /** Remove chaves sem atividade para o mapa não crescer sem limite. */
  private prune(now: number): void {
    if (this.hits.size < 10_000) return;
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) {
        this.hits.delete(key);
        this.deniedAt.delete(key);
      }
    }
  }
}

/**
 * Limita as rotas que gastam o LLM ou o modelo de embeddings (Unbounded
 * Consumption). O limite vem de LLM_RATE_LIMIT_PER_MINUTE.
 */
@Injectable()
export class LlmRateLimitGuard implements CanActivate {
  private readonly limit: number;

  constructor(
    private readonly limiter: RateLimiter,
    private readonly security: SecurityService,
    config: ConfigService,
  ) {
    this.limit = Number(config.get('LLM_RATE_LIMIT_PER_MINUTE')) || DEFAULT_LIMIT_PER_MINUTE;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? 'unknown';
    const { allowed, firstDenial, retryAfterMs } = this.limiter.take(key, this.limit);
    if (allowed) return true;

    // Registrar toda recusa transformaria o ataque num flood no banco de auditoria.
    if (firstDenial) {
      await this.security.recordRateLimit(`${request.method} ${request.path} from ${key}`);
    }
    context.switchToHttp().getResponse().setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
    throw new HttpException('Too many requests, try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
