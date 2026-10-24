import { PrismaClient, TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始种子数据初始化...');

  // 公司
  const company = await prisma.company.upsert({
    where: { code: 'demo' },
    update: {},
    create: {
      name: 'Demo 科技有限公司',
      code: 'demo',
      description: 'DataFlow Hub 演示企业',
    },
  });

  // 管理员
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dataflow.dev' },
    update: {},
    create: {
      email: 'admin@dataflow.dev',
      password: adminPassword,
      name: '系统管理员',
      role: UserRole.ADMIN,
      companyId: company.id,
    },
  });

  // 普通成员
  const memberPassword = await bcrypt.hash('member123', 10);
  const member = await prisma.user.upsert({
    where: { email: 'member@dataflow.dev' },
    update: {},
    create: {
      email: 'member@dataflow.dev',
      password: memberPassword,
      name: '张三',
      role: UserRole.MEMBER,
      companyId: company.id,
    },
  });

  // 项目经理
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@dataflow.dev' },
    update: {},
    create: {
      email: 'manager@dataflow.dev',
      password: managerPassword,
      name: '李经理',
      role: UserRole.MANAGER,
      companyId: company.id,
    },
  });

  // 项目
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'DataFlow Hub 核心平台',
      description: '企业数据任务协作与智能分析平台研发',
      ownerId: manager.id,
      companyId: company.id,
    },
  });

  // 任务
  await prisma.task.createMany({
    data: [
      {
        projectId: project.id,
        title: '完成 Auth 模块开发',
        description: '注册、登录、JWT、刷新令牌',
        priority: TaskPriority.HIGH,
        status: TaskStatus.DONE,
        creatorId: manager.id,
        assigneeId: member.id,
      },
      {
        projectId: project.id,
        title: '实现 Prisma 数据建模',
        description: 'User/Project/Task/Diary 等核心表',
        priority: TaskPriority.URGENT,
        status: TaskStatus.DONE,
        creatorId: admin.id,
        assigneeId: member.id,
      },
      {
        projectId: project.id,
        title: '接入 RabbitMQ 消息队列',
        description: '任务完成事件通知',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.DOING,
        creatorId: manager.id,
        assigneeId: member.id,
      },
      {
        projectId: project.id,
        title: 'AI Provider 智能分析',
        description: 'OpenAI / LocalAI 接入,生成日报摘要',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.TODO,
        creatorId: manager.id,
        assigneeId: member.id,
      },
    ],
    skipDuplicates: true,
  });

  // 长期记忆
  await prisma.memory.createMany({
    data: [
      {
        userId: member.id,
        type: 'USER_PREFERENCE',
        content: '技术偏好: NestJS + TypeScript + Prisma',
        importance: 8,
      },
      {
        userId: member.id,
        type: 'SKILL',
        content: '熟悉后端架构设计、消息队列、缓存',
        importance: 7,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ 种子数据初始化完成');
  console.log('   管理员: admin@dataflow.dev / admin123');
  console.log('   经理:   manager@dataflow.dev / manager123');
  console.log('   成员:   member@dataflow.dev / member123');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
