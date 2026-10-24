import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { SkipTransform } from 'src/common/decorators/skip-transform.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @SkipTransform()
  @Get()
  @ApiOperation({ summary: '健康检查' })
  check() {
    return {
      status: 'ok',
      service: 'dataflow-hub-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
