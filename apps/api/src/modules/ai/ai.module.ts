import { Module } from '@nestjs/common';
import { AggregationModule } from '../aggregation/aggregation.module';
import { MemoryModule } from '../memory/memory.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAiProvider, LocalAiProvider } from './providers/openai.provider';
import { FallbackAiProvider } from './providers/fallback.provider';

@Module({
  imports: [AggregationModule, MemoryModule],
  controllers: [AiController],
  providers: [AiService, OpenAiProvider, LocalAiProvider, FallbackAiProvider],
  exports: [AiService],
})
export class AiModule {}
