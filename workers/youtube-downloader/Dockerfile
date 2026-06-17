FROM node:22-alpine AS base
RUN apk add --no-cache ffmpeg python3 py3-pip deno
RUN pip install --upgrade --break-system-packages yt-dlp
RUN corepack enable && corepack prepare pnpm --activate
RUN npm install -g tsx@4.22.4

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY workers/youtube-downloader/ ./workers/youtube-downloader/
RUN pnpm install --frozen-lockfile

FROM deps AS runner
WORKDIR /app
COPY . .
CMD ["tsx", "workers/youtube-downloader/src/index.ts"]
