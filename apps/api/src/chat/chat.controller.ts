import { BadRequestException, Body, Controller, HttpException, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatHistoryMessage } from './prompt';

interface ChatRequestBody {
  documentId?: string;
  message?: string;
  history?: ChatHistoryMessage[];
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Streams the assistant answer over Server-Sent Events.
   *
   * Event sequence: one "sources" event with the retrieved chunks, then a
   * series of "token" events, then a final "done" event. Errors after the
   * stream has started are delivered as an "error" event.
   */
  @Post()
  async chat(@Body() body: ChatRequestBody, @Res() res: Response): Promise<void> {
    const { documentId, message } = body;
    if (!documentId || typeof documentId !== 'string') {
      throw new BadRequestException('documentId is required');
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new BadRequestException('message is required');
    }
    const history = Array.isArray(body.history) ? body.history : [];

    // Errors thrown before the stream starts become regular JSON errors.
    const stream = await this.chatService.ask(documentId, message.trim(), history).catch((error) => {
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

    this.writeEvent(res, 'sources', stream.sources);

    try {
      for await (const token of stream.tokens) {
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
