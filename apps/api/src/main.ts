import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const prefix = configService.get<string>('apiPrefix') ?? 'api';

  // 使用 Pino 日志
  app.useLogger(app.get(PinoLogger));

  // 全局 API 前缀
  app.setGlobalPrefix(prefix);

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 全局管道:DTO 校验 + 参数转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 注入 request-id 中间件
  app.use((req: any, res: any, next: () => void) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
    next();
  });

  // Swagger 文档
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DataFlow Hub API')
    .setDescription('企业数据任务协作与智能分析平台 - 接口文档')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization' },
      'access-token',
    )
    .addTag('auth', '认证鉴权')
    .addTag('users', '用户管理')
    .addTag('projects', '项目管理')
    .addTag('tasks', '任务管理')
    .addTag('diary', '工作日志')
    .addTag('memory', '长期记忆')
    .addTag('aggregation', '数据聚合')
    .addTag('ai', 'AI 智能分析')
    .addTag('notification', '通知')
    .addTag('health', '健康检查')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  Logger.log(`🚀 DataFlow Hub API 启动成功: http://localhost:${port}/${prefix}`, 'Bootstrap');
  Logger.log(`📖 Swagger 文档地址: http://localhost:${port}/${prefix}/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('应用启动失败:', err);
  process.exit(1);
});
