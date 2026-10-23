import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { SecurityModule } from '../security/security.module';
import { AnalystAgent } from './analyst.agent';
import { ConversationAgent } from './conversation.agent';

@Module({
  imports: [LlmModule, SecurityModule],
  providers: [AnalystAgent, ConversationAgent],
  exports: [AnalystAgent, ConversationAgent],
})
export class AgentsModule {}
