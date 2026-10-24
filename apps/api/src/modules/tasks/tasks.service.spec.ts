import { Test, TestingModule } from '@nestjs/testing';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RabbitmqService } from 'src/modules/rabbitmq/rabbitmq.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: jest.Mocked<PrismaService>;
  let rabbitmq: jest.Mocked<RabbitmqService>;

  const currentUser: CurrentUser = {
    userId: 1,
    email: 'admin@dataflow.dev',
    role: 'ADMIN',
    companyId: 1,
  };

  beforeEach(async () => {
    const prismaMock = {
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
    };
    const rabbitmqMock = {
      publishTaskEvent: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RabbitmqService, useValue: rabbitmqMock },
      ],
    }).compile();

    service = module.get(TasksService);
    prisma = module.get(PrismaService);
    rabbitmq = module.get(RabbitmqService);
  });

  describe('create', () => {
    it('项目存在时应成功创建任务', async () => {
      const dto: CreateTaskDto = {
        projectId: 1,
        title: '测试任务',
        priority: TaskPriority.HIGH,
      };
      prisma.project.findUnique.mockResolvedValue({ id: 1 } as any);
      prisma.task.create.mockResolvedValue({ id: 100, ...dto, creatorId: 1 } as any);

      const result = await service.create(dto, currentUser);

      expect(result.id).toBe(100);
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: '测试任务', creatorId: 1 }),
        }),
      );
    });

    it('项目不存在时应抛出 PROJECT_NOT_FOUND', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ projectId: 999, title: 'x' }, currentUser),
      ).rejects.toThrow(BizException);
    });
  });

  describe('update - 状态流转', () => {
    it('TODO -> DOING 合法', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        status: TaskStatus.TODO,
        projectId: 1,
      } as any);
      prisma.task.update.mockResolvedValue({ id: 1, status: TaskStatus.DOING } as any);

      const result = await service.update(1, { status: TaskStatus.DOING }, currentUser);
      expect(result.status).toBe(TaskStatus.DOING);
    });

    it('TODO -> DONE 非法,应抛出 TASK_STATUS_INVALID', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        status: TaskStatus.TODO,
        projectId: 1,
      } as any);

      await expect(
        service.update(1, { status: TaskStatus.DONE }, currentUser),
      ).rejects.toThrow(BizException);
    });

    it('任意状态 -> FAILED 合法', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        status: TaskStatus.DOING,
        projectId: 1,
      } as any);
      prisma.task.update.mockResolvedValue({ id: 1, status: TaskStatus.FAILED } as any);

      const result = await service.update(1, { status: TaskStatus.FAILED }, currentUser);
      expect(result.status).toBe(TaskStatus.FAILED);
    });

    it('任务变为 DONE 时应发布 RabbitMQ TASK_DONE 事件', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 1,
        status: TaskStatus.DOING,
        projectId: 5,
      } as any);
      prisma.task.update.mockResolvedValue({ id: 1, status: TaskStatus.DONE } as any);

      await service.update(1, { status: TaskStatus.DONE }, currentUser);

      expect(rabbitmq.publishTaskEvent).toHaveBeenCalledWith({
        type: 'TASK_DONE',
        userId: 1,
        taskId: 1,
        projectId: 5,
      });
    });
  });

  describe('findOne', () => {
    it('任务不存在时应抛出 TASK_NOT_FOUND', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(BizException);
    });
  });

  describe('findAll', () => {
    it('应返回分页结果', async () => {
      const query: QueryTaskDto = { page: 1, pageSize: 10, projectId: 1 };
      prisma.task.findMany.mockResolvedValue([{ id: 1 }] as any);
      prisma.task.count.mockResolvedValue(1);

      const result = await service.findAll(query);
      expect(result.total).toBe(1);
      expect(result.list).toHaveLength(1);
    });
  });
});
