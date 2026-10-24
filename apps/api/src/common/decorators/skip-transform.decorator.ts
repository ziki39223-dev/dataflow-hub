import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/** 跳过响应包装(如文件下载、Swagger 文档等) */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
