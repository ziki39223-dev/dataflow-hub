import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Pino 日志模块
 * - JSON 格式(生产) / pretty(开发)
 * - 自动记录 request_id
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('nodeEnv') === 'production';
        const level = config.get<string>('log.level') || 'info';
        return {
          pinoHttp: {
            level,
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                    ignore: 'pid,hostname,req,res,responseTime',
                    singleLine: false,
                  },
                },
            customProps: (req: any) => ({
              requestId: req.headers['x-request-id'],
              userId: req.user?.userId,
            }),
            serializers: {
              req(req: any) {
                return {
                  method: req.method,
                  url: req.url,
                  id: req.id,
                };
              },
            },
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie', '*.password'],
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
