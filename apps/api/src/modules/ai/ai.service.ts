import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { AggregationService } from '../aggregation/aggregation.service';
import { MemoryService } from '../memory/memory.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { AiProvider, AiReportAnalysis, ChatMessage } from './ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { LocalAiProvider } from './providers/openai.provider';
import { FallbackAiProvider } from './providers/fallback.provider';

/**
 * AI 服务
 * - 根据 AI_PROVIDER 配置选择具体 Provider
 * - 调用失败自动降级到 FallbackProvider
 * - 结合用户长期记忆生成更精准的分析
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: AiProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aggregationService: AggregationService,
    private readonly memoryService: MemoryService,
    openAiProvider: OpenAiProvider,
    localAiProvider: LocalAiProvider,
    fallbackProvider: FallbackAiProvider,
  ) {
    // 根据配置选择 Provider
    const providerName = this.configService.get<string>('ai.provider') || 'fallback';
    const providerMap: Record<string, AiProvider> = {
      openai: openAiProvider,
      local: localAiProvider,
      fallback: fallbackProvider,
    };
    this.provider = providerMap[providerName] || fallbackProvider;
    this.logger.log(`AI Provider 已启用: ${this.provider.name}`);
  }

  /** 生成某份报告的 AI 分析 */
  async analyzeReport(reportId: number): Promise<{ reportId: number; provider: string; analysis: AiReportAnalysis }> {
    const report = await this.aggregationService.findReportById(reportId);
    if (!report) throw BizException.reportNotFound();

    // 拉取用户长期记忆作为上下文
    const memories = await this.memoryService.findByUser(report.userId);
    const memoryContext = memories
      .map((m) => `- [${m.type}] ${m.content} (重要度:${m.importance})`)
      .join('\n');

    // 拉取当天任务明细
    const dayTasks = await this.prisma.task.findMany({
      where: {
        creatorId: report.userId,
        createdAt: {
          gte: report.date,
          lt: new Date(report.date.getTime() + 24 * 3600 * 1000),
        },
      },
      select: { title: true, status: true, priority: true },
    });

    const messages = this.buildPrompt(report.content, memoryContext, dayTasks);

    let raw: string;
    try {
      raw = await this.provider.chatCompletion(messages);
    } catch (err: any) {
      this.logger.warn(`AI 调用失败,降级到兜底分析: ${err.message}`);
      const fallback = new FallbackAiProvider();
      raw = await fallback.chatCompletion(messages);
    }

    const analysis = this.parseAnalysis(raw);

    // 将 AI 摘要写回报告
    await this.prisma.report.update({
      where: { id: reportId },
      data: { aiSummary: raw },
    });

    return { reportId, provider: this.provider.name, analysis };
  }

  /** 通用对话补全(供其他模块调用) */
  async chat(messages: ChatMessage[]): Promise<string> {
    return this.provider.chatCompletion(messages);
  }

  private buildPrompt(
    reportContent: string,
    memoryContext: string,
    tasks: Array<{ title: string; status: string; priority: string }>,
  ): ChatMessage[] {
    const taskList = tasks.map((t) => `- [${t.status}] ${t.title} (${t.priority})`).join('\n');

    const systemPrompt = `你是一名企业项目助理,擅长分析团队工作日报并给出专业建议。
请根据用户的工作日报,输出结构化分析,包含三个部分:
1. 今日完成: 总结已完成的主要工作
2. 风险: 指出潜在风险或未完成事项
3. 建议: 给出可执行的优化建议

请使用简洁的中文,每部分用要点列出。`;

    const userPrompt = `以下是今日工作日报:

${reportContent}

今日任务清单:
${taskList || '暂无任务'}

用户长期记忆(偏好与技能,供参考):
${memoryContext || '暂无记忆'}

请输出分析。`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /** 解析 AI 返回文本为结构化分析 */
  private parseAnalysis(raw: string): AiReportAnalysis {
    const completed = this.extractSection(raw, ['今日完成', '已完成', '完成']);
    const risks = this.extractSection(raw, ['风险', '风险点']);
    const suggestions = this.extractSection(raw, ['建议', '优化建议']);

    return {
      completed,
      risks,
      suggestions,
      raw,
    };
  }

  private extractSection(text: string, keywords: string[]): string[] {
    const lines = text.split('\n');
    const result: string[] = [];
    let inSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 检测是否进入目标区块
      if (keywords.some((kw) => trimmed.includes(kw))) {
        inSection = true;
        // 同行可能就有内容
        const afterColon = trimmed.split(/[:：]/)[1];
        if (afterColon && afterColon.trim()) result.push(afterColon.trim());
        continue;
      }
      // 进入下一个区块(以其他标题开头)则退出
      if (inSection && /^(今日完成|已完成|完成|风险|风险点|建议|优化建议)/.test(trimmed)) {
        break;
      }
      if (inSection && /^[-•*\d.、]/.test(trimmed)) {
        result.push(trimmed.replace(/^[-•*\d.、]+\s*/, ''));
      }
    }
    return result;
  }
}
