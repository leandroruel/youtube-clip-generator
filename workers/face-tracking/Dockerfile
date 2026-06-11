FROM node:22-alpine AS base
RUN apk add --no-cache ffmpeg
RUN corepack enable && corepack prepare pnpm --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY workers/face-tracking/ ./workers/face-tracking/
RUN pnpm install --frozen-lockfile

FROM deps AS runner
WORKDIR /app
COPY . .
CMD ["npx", "tsx", "workers/face-tracking/src/index.ts"]
