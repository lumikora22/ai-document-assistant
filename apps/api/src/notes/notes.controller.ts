import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LlmRateLimitGuard } from '../security/rate-limit.guard';
import { isNoteType, NOTE_TYPES } from './note-types';
import { NoteRecord, NotesService } from './notes.service';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50_000;

interface CreateNoteBody {
  title?: unknown;
  type?: unknown;
  content?: unknown;
}

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @UseGuards(LlmRateLimitGuard)
  create(@Body() body: CreateNoteBody): Promise<NoteRecord> {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!title) {
      throw new BadRequestException('title is required');
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new BadRequestException(`title must be at most ${MAX_TITLE_LENGTH} characters`);
    }
    if (!isNoteType(body.type)) {
      throw new BadRequestException(`type must be one of: ${NOTE_TYPES.join(', ')}`);
    }
    if (!content) {
      throw new BadRequestException('content is required');
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException(`content must be at most ${MAX_CONTENT_LENGTH} characters`);
    }

    return this.notesService.create({ title, type: body.type, content });
  }

  @Post(':id/entries')
  @UseGuards(LlmRateLimitGuard)
  addEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content?: unknown },
  ): Promise<NoteRecord> {
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      throw new BadRequestException('content is required');
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException(`content must be at most ${MAX_CONTENT_LENGTH} characters`);
    }
    return this.notesService.addEntry(id, content);
  }

  @Get()
  findAll(): Promise<NoteRecord[]> {
    return this.notesService.findAll();
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.notesService.remove(id);
  }
}
