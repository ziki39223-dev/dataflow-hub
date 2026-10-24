export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-dev',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    taskExchange: process.env.RABBITMQ_TASK_EXCHANGE || 'dataflow.task.exchange',
    notificationQueue:
      process.env.RABBITMQ_NOTIFICATION_QUEUE || 'dataflow.notification.queue',
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'local',
    openai: {
      apiKey: process.env.AI_OPENAI_API_KEY || '',
      baseUrl: process.env.AI_OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.AI_OPENAI_MODEL || 'gpt-4o-mini',
    },
    local: {
      baseUrl: process.env.AI_LOCAL_BASE_URL || 'http://localhost:8080/v1',
      model: process.env.AI_LOCAL_MODEL || 'local-model',
    },
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
