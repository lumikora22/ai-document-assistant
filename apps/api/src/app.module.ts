import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { NotesModule } from './notes/notes.module';
import { ChatModule } from './chat/chat.module';
import { MemoryModule } from './memory/memory.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      expandVariables: true,
    }),
    DatabaseModule,
    EmbeddingsModule,
    NotesModule,
    ChatModule,
    MemoryModule,
    SecurityModule,
  ],
})
export class AppModule {}
