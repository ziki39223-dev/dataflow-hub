import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

/**
 * RabbitMQ 服务
 * - 自动重连
 * - 发布消息到 fanout/direct exchange
 * - 提供消费接口
 */
@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string;
  private readonly taskExchange: string;
  private reconnecting = false;

  constructor(private readonly configService: ConfigService) {
    this.url = this.configService.get<string>('rabbitmq.url')!;
    this.taskExchange = this.configService.get<string>('rabbitmq.taskExchange')!;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore
    }
    this.logger.log('RabbitMQ 已断开');
  }

  private async connect(): Promise<void> {
    try {
      const conn = await amqp.connect(this.url);
      const ch = await conn.createChannel();
      this.connection = conn;
      this.channel = ch;
      // 声明任务事件交换机 (fanout,所有通知消费者都收到)
      await ch.assertExchange(this.taskExchange, 'fanout', { durable: true });

      conn.on('close', () => {
        this.logger.warn('RabbitMQ 连接关闭,尝试重连...');
        if (!this.reconnecting) this.scheduleReconnect();
      });
      conn.on('error', (err) => {
        this.logger.error(`RabbitMQ 连接错误: ${err.message}`);
      });

      this.logger.log('RabbitMQ 已连接');
    } catch (err: any) {
      this.logger.error(`RabbitMQ 连接失败: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.reconnecting = true;
    setTimeout(async () => {
      this.reconnecting = false;
      await this.connect();
    }, 3000);
  }

  /** 发布任务事件消息 */
  async publishTaskEvent(message: unknown): Promise<boolean> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel 不可用,消息丢弃');
      return false;
    }
    try {
      const buffer = Buffer.from(JSON.stringify(message));
      this.channel.publish(this.taskExchange, '', buffer, { persistent: true });
      return true;
    } catch (err: any) {
      this.logger.error(`发布消息失败: ${err.message}`);
      return false;
    }
  }

  /** 订阅任务事件 */
  async consumeTaskEvents(
    queue: string,
    handler: (msg: unknown) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel 不可用,无法消费');
      return;
    }
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, this.taskExchange, '');
    await this.channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel?.ack(msg);
        } catch (err: any) {
          this.logger.error(`消费消息失败: ${err.message}`);
          this.channel?.nack(msg, false, false); // 不重新入队,避免死循环
        }
      },
      { noAck: false },
    );
    this.logger.log(`已订阅队列 ${queue}`);
  }
}
