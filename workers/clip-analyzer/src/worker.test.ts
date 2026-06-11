import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./analyzer.js', () => ({
  analyzeTranscript: vi.fn(),
}));

import { handleMessage, type NatsMsg, type DB } from './worker.js';
import { analyzeTranscript } from './analyzer.js';

const mockAnalyzeTranscript = vi.mocked(analyzeTranscript);

function mockDb() {
  const whereUpdate = vi.fn().mockResolvedValue(undefined);
  const transcriptWhere = vi.fn().mockResolvedValue([{
    id: 'transcript-1',
    videoId: 'video-1',
    fullText: 'Hello world. This is a test.',
    segments: [
      { start: 0, end: 2.5, text: 'Hello world' },
      { start: 2.5, end: 5, text: 'This is a test' },
    ],
    model: 'whisper-large-v3',
    language: 'en',
  }]);

  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: whereUpdate,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: transcriptWhere,
      })),
    })),
  } as unknown as DB;
}

function mockNatsMsg(overrides?: Partial<NatsMsg>): NatsMsg {
  return {
    ack: vi.fn(),
    term: vi.fn(),
    data: new TextEncoder().encode(JSON.stringify({
      jobId: 'job-1',
      projectId: 'proj-1',
      videoId: 'video-1',
    })),
    ...overrides,
  };
}

function mockLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn(), trace: vi.fn(), silent: vi.fn(), child: vi.fn(), level: 'info', levels: {}, bindings: vi.fn(), flush: vi.fn(), isLevelEnabled: vi.fn() } as never;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockAnalyzeTranscript.mockReturnValue([
    {
      start: 0,
      end: 5,
      text: 'Hello world',
      viralScore: { total: 0.85, hookScore: 0.9, emotionScore: 0.5, engagementScore: 0.7, transcriptScore: 0.6, mostReplayed: 0.8 },
      reasoning: 'strong hook language, high emotional impact',
    },
  ]);
});

describe('handleMessage', () => {
  describe('success path', () => {
    it('processes a clip analysis job end-to-end', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const logger = mockLogger();

      await handleMessage(msg, db, logger);

      expect(db.update).toHaveBeenCalled();
      expect(db.select).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
      expect(mockAnalyzeTranscript).toHaveBeenCalled();
      expect(msg.ack).toHaveBeenCalled();
      expect(msg.term).not.toHaveBeenCalled();
    });

    it('inserts clip records for each candidate', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const logger = mockLogger();

      await handleMessage(msg, db, logger);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('failure paths', () => {
    it('handles transcript not found', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const logger = mockLogger();

      const transcriptWhere = vi.fn().mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({ from: vi.fn(() => ({ where: transcriptWhere })) } as never);

      await handleMessage(msg, db, logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('handles no candidates found', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const logger = mockLogger();

      mockAnalyzeTranscript.mockReturnValue([]);

      await handleMessage(msg, db, logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('terms failed messages', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const logger = mockLogger();

      mockAnalyzeTranscript.mockImplementation(() => {
        throw new Error('Analysis crashed');
      });

      await handleMessage(msg, db, logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });
  });
});
