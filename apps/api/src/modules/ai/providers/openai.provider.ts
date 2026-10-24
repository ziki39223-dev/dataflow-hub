import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, ChatMessage } from '../ai-provider.interface';

/**
 * OpenAI 兼容的 Provider 基类
 * 同时支撑 OpenAI 官方与任何 OpenAI 兼容的本地服务(通过 baseUrl 配置)
 */
export abstract class OpenAiCompatibleProvider implements AiProvider {
  protected readonly logger: Logger;
  abstract readonly name: string;
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly model: string;

  constructor(
    protected readonly configService: ConfigService,
    loggerName: string,
    baseUrl: string,
    apiKey: string,
    model: string,
  ) {
    this.logger = new Logger(loggerName);
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
  }

  async chatCompletion(messages: ChatMessage[]): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const body = {
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AI 请求失败 ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('AI 返回内容为空');
      return content.trim();
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * OpenAI 官方 Provider
 */
@Injectable()
export class OpenAiProvider extends OpenAiCompatibleProvider {
  readonly name = 'openai';

  constructor(configService: ConfigService) {
    super(
      configService,
      OpenAiProvider.name,
      configService.get<string>('ai.openai.baseUrl') || 'https://api.openai.com/v1',
      configService.get<string>('ai.openai.apiKey') || '',
      configService.get<string>('ai.openai.model') || 'gpt-4o-mini',
    );
  }
}

/**
 * LocalAI 本地 Provider (OpenAI 兼容协议)
 */
@Injectable()
export class LocalAiProvider extends OpenAiCompatibleProvider {
  readonly name = 'local';

  constructor(configService: ConfigService) {
    super(
      configService,
      LocalAiProvider.name,
      configService.get<string>('ai.local.baseUrl') || 'http://localhost:8080/v1',
      '', // 本地服务通常无需鉴权
      configService.get<string>('ai.local.model') || 'local-model',
    );
  }
}
