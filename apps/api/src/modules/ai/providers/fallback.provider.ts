import { Injectable } from '@nestjs/common';
import { AiProvider, ChatMessage } from '../ai-provider.interface';

/**
 * 兜底 Provider
 * 当未配置 AI API Key 或调用失败时,基于规则生成基础分析
 * 保证业务可用性,不依赖外部服务
 */
@Injectable()
export class FallbackAiProvider implements AiProvider {
  readonly name = 'fallback';

  async chatCompletion(messages: ChatMessage[]): Promise<string> {
    // 从 user 消息中提取报告内容,生成规则化摘要
    const userMsg = messages.find((m) => m.role === 'user');
    const content = userMsg?.content || '';

    // 简单提取关键信息
    const taskTotal = this.extractNumber(content, /任务总数[:：\s]*(\d+)/);
    const taskDone = this.extractNumber(content, /已完成[:：\s]*(\d+)/);
    const completionRate = taskTotal > 0 ? ((taskDone / taskTotal) * 100).toFixed(1) : '0';

    const lines: string[] = [];
    lines.push('今日完成:');
    lines.push(`- 共完成任务 ${taskDone} 项,完成率 ${completionRate}%`);
    lines.push('');
    lines.push('风险:');
    if (taskTotal > 0 && taskDone < taskTotal) {
      lines.push(`- 还有 ${taskTotal - taskDone} 项任务未完成,需关注进度`);
    } else if (taskTotal === 0) {
      lines.push('- 今日无任务记录,建议规划明日工作');
    } else {
      lines.push('- 无明显风险,任务全部完成');
    }
    lines.push('');
    lines.push('建议:');
    if (taskTotal > 0 && taskDone < taskTotal) {
      lines.push('- 优先处理未完成任务,合理分配时间');
    } else {
      lines.push('- 保持良好节奏,持续产出日报');
    }
    lines.push('- (当前为兜底规则分析,配置 AI_PROVIDER 后可获取智能建议)');

    return lines.join('\n');
  }

  private extractNumber(text: string, pattern: RegExp): number {
    const match = text.match(pattern);
    return match ? parseInt(match[1], 10) : 0;
  }
}
