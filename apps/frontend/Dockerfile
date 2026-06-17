FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/frontend/ ./apps/frontend/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
RUN pnpm --filter frontend run build

FROM nginx:stable-alpine AS runner
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
