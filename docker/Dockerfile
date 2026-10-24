# ===== 构建阶段 =====
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖描述文件
COPY package.json package-lock.json* ./
COPY prisma ./apps/api/prisma
COPY apps/api/prisma ./apps/api/prisma

# 安装依赖
RUN npm install --legacy-peer-deps

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY apps ./apps

# 生成 Prisma Client
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

# 构建
RUN npm run build

# ===== 生产阶段 =====
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["node", "dist/apps/api/main.js"]
