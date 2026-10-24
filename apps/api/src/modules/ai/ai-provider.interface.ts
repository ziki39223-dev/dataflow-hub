/**
 * AI Provider 抽象接口
 * 支持 OpenAI / LocalAI 等不同实现,通过 AI_PROVIDER 配置切换
 */
export interface AiProvider {
  /** 提供者名称 */
  readonly name: string;

  /**
   * 发送对话补全请求
   * @param messages 对话消息列表
   * @returns AI 返回的文本内容
   */
  chatCompletion(messages: ChatMessage[]): Promise<string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** AI 分析报告结构 */
export interface AiReportAnalysis {
  /** 今日完成 */
  completed: string[];
  /** 风险点 */
  risks: string[];
  /** 优化建议 */
  suggestions: string[];
  /** 原始 AI 返回文本 */
  raw: string;
}
