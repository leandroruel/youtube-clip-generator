FROM node:22-alpine AS base
RUN apk add --no-cache yt-dlp
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
RUN apk add --no-cache python3 make gcc g++
WORKDIR /app
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY workers/youtube-downloader/package.json ./workers/youtube-downloader/package.json
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

FROM deps AS runner
WORKDIR /app
COPY . .
CMD ["npx", "tsx", "workers/youtube-downloader/src/index.ts"]
