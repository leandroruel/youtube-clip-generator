FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

FROM deps AS runner
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npx", "tsx", "apps/api/src/index.ts"]
