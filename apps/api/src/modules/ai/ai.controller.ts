import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AiService } from './ai.service';

class ChatDto {
  @ApiProperty({ description: '用户消息' })
  @IsString()
  message: string;
}

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('report/:id')
  @ApiOperation({ summary: 'AI 分析指定日报(生成今日完成/风险/建议)' })
  analyzeReport(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.analyzeReport(id);
  }

  @Post('chat')
  @ApiOperation({ summary: 'AI 通用对话' })
  chat(@Body() dto: ChatDto) {
    return this.aiService.chat([{ role: 'user', content: dto.message }]);
  }
}
