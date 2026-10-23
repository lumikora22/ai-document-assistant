import { BadRequestException, Body, Controller, HttpException, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { LlmRateLimitGuard } from '../security/rate-limit.guard';
import { ChatService } from './chat.service';

/**
 * A "history" field sent by older clients is ignored: the conversation is
 * read from the database so a client cannot forge assistant messages.
 */
interface ChatRequestBody {
  noteId?: string;
  message?: string;
  conversationId?: string;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Streams the assistant answer over Server-Sent Events.
   *
   * Event sequence: one "conversation" event with the id to send back on the
   * next message, one "sources" event with the retrieved chunks, then a
   * series of "token" events, then a final "done" event. Errors after the
   * stream has started are delivered as an "error" event.
   */
  @Post()
  @UseGuards(LlmRateLimitGuard)
  async chat(@Body() body: ChatRequestBody, @Res() res: Response): Promise<void> {
    const { noteId, message } = body;
    if (!noteId || typeof noteId !== 'string') {
      throw new BadRequestException('noteId is required');
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new BadRequestException('message is required');
    }
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined;

    // Errors thrown before the stream starts become regular JSON errors.
    const stream = await this.chatService.ask(noteId, message.trim(), conversationId).catch((error) => {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException((error as Error).message);
    });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    this.writeEvent(res, 'conversation', { id: stream.conversationId });
    this.writeEvent(res, 'sources', stream.sources);

    // Se o cliente fechar a aba, parar de ler cancela a requisição à OpenRouter e para de gastar tokens.
    let closed = false;
    res.on('close', () => {
      closed = true;
    });

    try {
      for await (const token of stream.tokens) {
        if (closed) break;
        this.writeEvent(res, 'token', { content: token });
      }
      this.writeEvent(res, 'done', {});
    } catch (error) {
      this.writeEvent(res, 'error', { message: (error as Error).message });
    } finally {
      res.end();
    }
  }

  private writeEvent(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}
