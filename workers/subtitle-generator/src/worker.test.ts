import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => ({ pipe: vi.fn() })),
  createWriteStream: vi.fn(() => ({})),
  writeFileSync: vi.fn(),
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(),
}));

vi.mock('@clipper/storage', () => ({
  getObject: vi.fn(),
  uploadStream: vi.fn(),
}));

vi.mock('./subtitler.js', () => ({
  writeSRTFile: vi.fn(),
  burnSubtitles: vi.fn(),
  cleanupFile: vi.fn(),
}));

import { handleMessage, type NatsMsg, type DB } from './worker.js';
import { writeSRTFile, burnSubtitles, cleanupFile } from './subtitler.js';
import { getObject, uploadStream } from '@clipper/storage';
import { pipeline } from 'node:stream/promises';

const mockWriteSRTFile = vi.mocked(writeSRTFile);
const mockBurnSubtitles = vi.mocked(burnSubtitles);
const mockCleanupFile = vi.mocked(cleanupFile);
const mockGetObject = vi.mocked(getObject);
const mockUploadStream = vi.mocked(uploadStream);
const mockPipeline = vi.mocked(pipeline);

function mockDb() {
  const whereUpdate = vi.fn().mockResolvedValue(undefined);
  const clipRows = [{ id: 'clip-1', projectId: 'proj-1', videoId: 'video-1', startTime: 10, endTime: 30, status: 'framed' }];
  const transcriptRows = [{
    id: 'transcript-1',
    videoId: 'video-1',
    segments: [
      { start: 0, end: 5, text: 'Beginning intro' },
      { start: 12, end: 18, text: 'This is the clip content' },
      { start: 20, end: 28, text: 'More content in the clip' },
      { start: 35, end: 40, text: 'Outside the clip' },
    ],
  }];
  const videoRows = [{ id: 'video-1', originalPath: 'videos/original/video-1.mp4' }];

  let selectCallCount = 0;
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) return clipRows;
        if (selectCallCount === 2) return transcriptRows;
        return videoRows;
      }),
    })),
  }));

  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: whereUpdate,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    select,
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
      clipId: 'clip-1',
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
  mockUploadStream.mockResolvedValue(undefined as never);

  mockBurnSubtitles.mockReturnValue({ outputPath: '/tmp/clip-1-subtitled.mp4' });
});

describe('handleMessage', () => {
  describe('success path', () => {
    it('processes a subtitle job end-to-end', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const bucket = 'clipper';
      const logger = mockLogger();

      await handleMessage(msg, db, s3, bucket, logger);

      expect(db.select).toHaveBeenCalled();
      expect(mockWriteSRTFile).toHaveBeenCalled();
      expect(mockUploadStream).toHaveBeenCalled();
      expect(mockBurnSubtitles).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
      expect(msg.ack).toHaveBeenCalled();
      expect(msg.term).not.toHaveBeenCalled();
    });
  });

  describe('failure paths', () => {
    it('handles clip not found', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      const clipWhere = vi.fn().mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({ from: vi.fn(() => ({ where: clipWhere })) } as never);

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('handles transcript not found', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      const transcriptWhere = vi.fn().mockResolvedValue([]);
      const clipWhere = vi.fn().mockResolvedValue([{ id: 'clip-1', videoId: 'video-1', startTime: 0, endTime: 10, status: 'framed' }]);
      const selectMock = vi.fn()
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: clipWhere })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: transcriptWhere })) });
      vi.mocked(db.select).mockImplementation(selectMock);

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('handles no segments in clip range', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      const transcriptWhere = vi.fn().mockResolvedValue([{
        id: 'transcript-1',
        videoId: 'video-1',
        segments: [{ start: 50, end: 60, text: 'Far away' }],
      }]);
      const clipWhere = vi.fn().mockResolvedValue([{ id: 'clip-1', videoId: 'video-1', startTime: 0, endTime: 10, status: 'framed' }]);
      const selectMock = vi.fn()
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: clipWhere })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: transcriptWhere })) });
      vi.mocked(db.select).mockImplementation(selectMock);

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('cleans up temp files on failure', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockBurnSubtitles.mockImplementation(() => {
        throw new Error('FFmpeg failed');
      });

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(mockCleanupFile).toHaveBeenCalled();
      expect(msg.term).toHaveBeenCalled();
    });
  });
});
