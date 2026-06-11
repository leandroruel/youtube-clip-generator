import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(() => ({})),
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(),
}));

vi.mock('@clipper/storage', () => ({
  getObject: vi.fn(),
}));

vi.mock('./transcriber.js', () => ({
  transcribeAudio: vi.fn(),
  cleanupFile: vi.fn(),
}));

import { handleMessage, type NatsMsg, type DB } from './worker.js';
import { transcribeAudio, cleanupFile } from './transcriber.js';
import { getObject } from '@clipper/storage';
import { pipeline } from 'node:stream/promises';

const mockTranscribeAudio = vi.mocked(transcribeAudio);
const mockCleanupFile = vi.mocked(cleanupFile);
const mockGetObject = vi.mocked(getObject);
const mockPipeline = vi.mocked(pipeline);

function mockDb() {
  const whereUpdate = vi.fn().mockResolvedValue(undefined);
  const whereSelect = vi.fn().mockResolvedValue([{
    id: 'video-1',
    projectId: 'proj-1',
    title: 'Test Video',
    source: 'youtube',
    audioPath: 'audio/abc123.opus',
    duration: 3600,
    status: 'audio_ready',
    thumbnailPath: 'https://example.com/thumb.jpg',
  }]);

  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: whereUpdate,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'transcript-1' }]),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: whereSelect,
      })),
    })),
  } as unknown as DB;
}

function mockS3() {
  return { send: vi.fn() } as never;
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

  mockGetObject.mockResolvedValue({
    Body: { pipe: vi.fn(), on: vi.fn() } as never,
    $metadata: { httpStatusCode: 200 } as never,
  } as never);

  mockPipeline.mockResolvedValue(undefined);

  mockTranscribeAudio.mockReturnValue({
    segments: [
      { start: 0, end: 2.5, text: 'Hello world' },
      { start: 2.5, end: 5, text: 'This is a test' },
    ],
    fullText: 'Hello world. This is a test.',
    language: 'en',
  });
});

describe('handleMessage', () => {
  describe('success path', () => {
    it('processes a speech-to-text job end-to-end', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const bucket = 'clipper';
      const logger = mockLogger();

      await handleMessage(msg, db, s3, bucket, logger);

      expect(db.update).toHaveBeenCalled();
      expect(db.select).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
      expect(mockGetObject).toHaveBeenCalled();
      expect(mockPipeline).toHaveBeenCalled();
      expect(mockTranscribeAudio).toHaveBeenCalled();
      expect(msg.ack).toHaveBeenCalled();
      expect(msg.term).not.toHaveBeenCalled();
    });

    it('downloads audio from S3', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(mockGetObject).toHaveBeenCalledWith(s3, 'clipper', 'audio/abc123.opus');
    });

    it('saves transcript to database', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('failure paths', () => {
    it('handles video not found', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      const whereSelect = vi.fn().mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({ from: vi.fn(() => ({ where: whereSelect })) } as never);

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('handles video with no audio path', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      const whereSelect = vi.fn().mockResolvedValue([{ id: 'video-1', audioPath: null }]);
      vi.mocked(db.select).mockReturnValue({ from: vi.fn(() => ({ where: whereSelect })) } as never);

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('handles transcription failure', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockTranscribeAudio.mockImplementation(() => {
        throw new Error('Whisper failed');
      });

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('cleans up temp file on failure', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockTranscribeAudio.mockImplementation(() => {
        throw new Error('Whisper failed');
      });

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(mockCleanupFile).toHaveBeenCalled();
    });

    it('terms failed messages', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockGetObject.mockRejectedValue(new Error('S3 error'));

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });
  });
});
