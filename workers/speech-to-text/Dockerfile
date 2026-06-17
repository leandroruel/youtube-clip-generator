FROM node:22-alpine AS base
RUN apk add --no-cache ffmpeg
RUN corepack enable && corepack prepare pnpm --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY workers/speech-to-text/ ./workers/speech-to-text/
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS whisper-builder
RUN apk add --no-cache git cmake make g++ linux-headers
RUN git clone --depth 1 --branch v1.8.6 https://github.com/ggml-org/whisper.cpp /whisper
WORKDIR /whisper
RUN cmake -B build -DBUILD_SHARED_LIBS=OFF && \
    cmake --build build --config Release -j$(nproc) --target whisper-cli

FROM deps AS runner
WORKDIR /app
COPY --from=whisper-builder /whisper/build/bin/whisper-cli /usr/local/bin/whisper-cli
RUN /usr/local/bin/whisper-cli --help > /dev/null 2>&1 && echo "whisper-cli OK"
RUN mkdir -p /tmp/whisper-models /tmp/clipper-transcribe
RUN wget -q -O /tmp/whisper-models/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
COPY . .
CMD ["npx", "tsx", "workers/speech-to-text/src/index.ts"]
