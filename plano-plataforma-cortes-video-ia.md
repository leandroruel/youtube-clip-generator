# Plataforma de Geração Inteligente de Cortes para Vídeos Longos

## Visão Geral

Plataforma SaaS para transformar vídeos longos (podcasts, entrevistas, palestras e lives) em múltiplos cortes verticais otimizados para Shorts, Reels e TikTok.

Objetivos:

- Gerar cortes automaticamente utilizando IA
- Detectar momentos virais
- Gerar legendas automáticas
- Reenquadrar pessoas automaticamente para formato vertical
- Permitir edição manual através de timeline
- Escalar para vídeos de várias horas
- Operar com máxima eficiência de recursos

---

# Diferenciais

## Descoberta Inteligente de Conteúdo

A plataforma não apenas corta vídeos.

Ela identifica:

- Momentos virais
- Histórias interessantes
- Opiniões polêmicas
- Piadas
- Revelações
- Hooks de alta retenção
- Conteúdo educativo

---

# Stack Tecnológica

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- TanStack Router
- Zustand
- Immer

## Backend

- Fastify
- TypeScript
- Zod

## Banco

- PostgreSQL

## ORM

- Drizzle ORM

## Cache

- Redis

## Storage

- Garage (desenvolvimento)
- Amazon S3 (produção)

## Filas

- NATS JetStream

## Workflow Engine

- Temporal

## Processamento de Vídeo

- FFmpeg

## IA

- Whisper Large-v3
- OpenAI
- YOLO
- MediaPipe
- InsightFace

## Infraestrutura

- Kubernetes
- Helm
- ArgoCD

## Observabilidade

- OpenTelemetry
- Prometheus
- Grafana
- Loki

---

# Arquitetura

## Domínio Editor

Responsável por:

- Projetos
- Timeline
- Legendas
- Assets
- Preview
- Exportações

## Domínio Processing

Responsável por:

- Download Youtube
- Speech-to-Text
- Face Tracking
- Detecção de momentos virais
- Renderização

---

# Pipeline Otimizado

## Fluxo Principal

1. Usuário envia URL do YouTube
2. Sistema coleta metadados
3. Download apenas do áudio
4. Speech-to-Text
5. Identificação de cortes candidatos
6. Ranking dos cortes
7. Download do vídeo
8. Face Tracking apenas nos cortes selecionados
9. Renderização
10. Disponibilização para download

---

# Otimização de Recursos

## Estratégia Principal

Nunca baixar vídeo completo inicialmente.

### Fluxo

YouTube URL

↓

Download apenas do áudio

↓

Transcrição

↓

Análise IA

↓

Seleção de cortes

↓

Download vídeo

↓

Render

---

# Download de Áudio

Formato recomendado:

## Opus

Motivos:

- Extremamente leve
- Excelente qualidade
- Compatível com Whisper
- Formato utilizado pelo próprio YouTube

Exemplo:

Podcast 2 horas

Vídeo:
3-5 GB

Áudio Opus:
50-100 MB

---

# Speech To Text

## Whisper Large-v3

Entrada:

- opus
- wav
- mp3
- m4a

Saída:

- texto
- timestamps
- segmentos

Exemplo:

```json
{
  "start": 15.2,
  "end": 18.5,
  "text": "Hoje vamos falar sobre inteligência artificial"
}
```

---

# Sistema de Descoberta de Momentos Virais

## Viral Score

A pontuação final é composta por:

Viral Score =
Most Replayed +
Transcript Score +
Hook Score +
Emotion Score +
Engagement Score

---

## Most Replayed

Caso disponível:

- Identifica trechos revisados pelo público
- Recebe peso relevante no ranking

Observação:

Não deve ser dependência principal.

---

## Análise da Transcrição

IA identifica:

- Histórias
- Polêmicas
- Curiosidades
- Lições
- Momentos emocionais
- Conteúdo compartilhável

---

## Detecção de Hooks

Exemplos:

- "ninguém fala sobre isso"
- "vou revelar uma coisa"
- "isso mudou minha vida"
- "o maior erro que vejo"

---

## Análise de Emoção

Sinais:

- volume
- velocidade
- pitch

Objetivo:

Detectar momentos de entusiasmo ou surpresa.

---

# Embeddings e Busca Semântica

A transcrição gera embeddings.

Permite:

- Buscar assuntos específicos
- Filtrar cortes por tema
- Encontrar trechos rapidamente

Exemplos:

"Mostrar todos os momentos sobre Kubernetes"

"Mostrar todos os momentos sobre MCP"

---

# Face Tracking

Objetivo:

Transformar vídeo horizontal em vertical.

Formato de saída:

1080x1920

Aspect Ratio:

9:16

---

## Otimização

Baixar também um vídeo proxy:

360p

Executar:

- YOLO
- MediaPipe

Somente no proxy.

As coordenadas são reutilizadas no vídeo original.

---

# Sistema de Legendas

Funcionalidades:

- Fonte personalizada
- Cor personalizada
- Tamanho
- Contorno
- Sombra
- Posição
- Templates

---

## Tipos de Animação

### TikTok Style

Palavras aparecem conforme são faladas.

### Karaoke

Destaque progressivo.

### Bounce

Escala de entrada.

### Fade

Fade-in.

### Slide

Entrada lateral.

---

# Timeline

Funcionalidades:

- Adicionar vídeos
- Adicionar imagens
- Adicionar áudio
- Adicionar textos
- Legendas
- Efeitos
- Zoom
- Drag and Drop
- Snapping

---

# Estrutura da Timeline

```json
{
  "tracks": [
    {
      "type": "video"
    },
    {
      "type": "audio"
    },
    {
      "type": "subtitle"
    },
    {
      "type": "effects"
    }
  ]
}
```

---

# Renderização

Toda renderização ocorre no backend.

Fluxo:

Timeline

↓

FFmpeg

↓

Render Worker

↓

S3/MinIO

↓

Download

---

# Workers

## youtube-downloader

Responsável por:

- Download de áudio
- Download de vídeo
- Proxy videos

## speech-to-text

Responsável por:

- Whisper
- Transcrições

## clip-analyzer

Responsável por:

- IA
- Viral score
- Seleção de cortes

## face-tracking

Responsável por:

- YOLO
- MediaPipe

## subtitle-generator

Responsável por:

- Geração de legendas

## renderer

Responsável por:

- FFmpeg
- Exportações

---

# Escalabilidade

Todos os workers são independentes.

Escalam horizontalmente.

Exemplo:

- 2 Speech Workers
- 10 Render Workers
- 5 Face Tracking Workers

Sem impacto nos demais serviços.

---

# Kubernetes Day One

Serviços:

- web
- api
- temporal
- postgres
- redis
- nats
- speech-worker
- clip-worker
- face-worker
- render-worker

---

# Estrutura de Banco

## users

Usuários

## projects

Projetos

## videos

Vídeos

## clips

Cortes

## transcripts

Transcrições

## embeddings

Vetores semânticos

## jobs

Jobs

## renders

Renderizações

---

# Armazenamento

Estrutura:

videos/original/

videos/proxy/

audio/

transcripts/

clips/

renders/

thumbnails/

subtitles/

---

# MVP

## Fase 1

- URL YouTube
- Download áudio
- Whisper
- Geração automática de cortes
- Legendas automáticas
- Download dos cortes

## Fase 2

- Face Tracking
- Reenquadramento automático
- Templates de legenda

## Fase 3

- Timeline completa
- Edição manual
- Assets personalizados

## Fase 4

- Embeddings
- Busca semântica
- Organização inteligente de conteúdo

---

# Visão Final

O produto não deve ser apenas um gerador de cortes.

Ele deve evoluir para uma plataforma de descoberta, organização, edição e distribuição de conteúdo baseada em IA, capaz de transformar horas de vídeo em dezenas de conteúdos prontos para publicação com o menor custo computacional possível.
