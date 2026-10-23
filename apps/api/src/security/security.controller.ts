import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ScanResult } from './injection-detector';
import { SensitiveKind } from './sensitive-data';
import { MAX_CHAT_MESSAGE_CHARS, OwaspSummaryItem, SecurityEventRecord, SecurityService } from './security.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  /** Auditoria: bloqueios, trechos sinalizados e memórias rejeitadas. Use ?noteId= para filtrar. */
  @Get('events')
  events(@Query('noteId') noteId?: string): Promise<SecurityEventRecord[]> {
    if (noteId && !UUID_PATTERN.test(noteId)) {
      throw new BadRequestException('noteId must be a UUID');
    }
    return this.security.listEvents(noteId || undefined);
  }

  /** Eventos agrupados pelas categorias do OWASP Top 10 for LLM Applications (2025). */
  @Get('summary')
  summary(): Promise<OwaspSummaryItem[]> {
    return this.security.owaspSummary();
  }

  /** Pontua um texto contra o detector sem registrar nada, para testar as regras. */
  @Post('scan')
  @HttpCode(200)
  scan(@Body() body: { text?: unknown }): ScanResult & { sensitive: SensitiveKind[] } {
    if (typeof body.text !== 'string' || body.text.length === 0) {
      throw new BadRequestException('text is required');
    }
    if (body.text.length > MAX_CHAT_MESSAGE_CHARS * 5) {
      throw new BadRequestException('text is too long');
    }
    const { scan, sensitive } = this.security.inspect(body.text);
    return { ...scan, sensitive };
  }
}
