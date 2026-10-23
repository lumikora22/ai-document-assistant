import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ConversationMemory, MemoryGraph, MemoryService } from './memory.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read-only endpoints for the memory pop-up. Pass ?noteId= to limit to one note. */
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get()
  list(@Query('noteId') noteId?: string): Promise<ConversationMemory[]> {
    return this.memory.listMemories(parseNoteId(noteId));
  }

  @Get('graph/entities')
  entityGraph(@Query('noteId') noteId?: string): Promise<MemoryGraph> {
    return this.memory.entityGraph(parseNoteId(noteId));
  }

  @Get('graph/rag')
  ragGraph(@Query('noteId') noteId?: string): Promise<MemoryGraph> {
    return this.memory.ragGraph(parseNoteId(noteId));
  }
}

function parseNoteId(noteId?: string): string | undefined {
  if (!noteId) {
    return undefined;
  }
  if (!UUID_PATTERN.test(noteId)) {
    throw new BadRequestException('noteId must be a UUID');
  }
  return noteId;
}
