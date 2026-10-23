import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { LlmModule } from '../llm/llm.module';
import { MemoryModule } from '../memory/memory.module';
import { NotesModule } from '../notes/notes.module';
import { SecurityModule } from '../security/security.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [EmbeddingsModule, NotesModule, MemoryModule, LlmModule, SecurityModule, AgentsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
