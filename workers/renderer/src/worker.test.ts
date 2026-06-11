import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => ({ pipe: vi.fn() })),
  createWriteStream: vi.fn(() => ({})),
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(),
}));

vi.mock('@clipper/storage', () => ({
  getObject: vi.fn(),
  uploadStream: vi.fn(),
}));

vi.mock('./renderer.js', () => ({
  renderClip: vi.fn(),
  cleanupFile: vi.fn(),
}));

import { handleMessage, type NatsMsg, type DB } from './worker.js';
import { renderClip, cleanupFile } from './renderer.js';
import { getObject, uploadStream } from '@clipper/storage';
import { pipeline } from 'node:stream/promises';

const mockRenderClip = vi.mocked(renderClip);
const mockCleanupFile = vi.mocked(cleanupFile);
const mockGetObject = vi.mocked(getObject);
const mockUploadStream = vi.mocked(uploadStream);
const mockPipeline = vi.mocked(pipeline);

function mockDb() {
  const whereUpdate = vi.fn().mockResolvedValue(undefined);
  const clipRows = [{ id: 'clip-1', projectId: 'proj-1', videoId: 'video-1', startTime: 10, endTime: 40, status: 'subtitled', cropParams: { x: 656, y: 0, width: 608, height: 1080, confidence: 0.7 } }];
  const videoRows = [{ id: 'video-1', originalPath: 'videos/original/video-1.mp4' }];

  let selectCallCount = 0;
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) return clipRows;
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

  mockRenderClip.mockReturnValue({
    outputPath: '/tmp/clip-1-final.mp4',
    duration: 30,
    fileSize: 5000000,
  });
});

describe('handleMessage', () => {
  describe('success path', () => {
    it('processes a render job end-to-end', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const bucket = 'clipper';
      const logger = mockLogger();

      await handleMessage(msg, db, s3, bucket, logger);

      expect(db.select).toHaveBeenCalled();
      expect(mockGetObject).toHaveBeenCalled();
      expect(mockPipeline).toHaveBeenCalled();
      expect(mockRenderClip).toHaveBeenCalled();
      expect(mockUploadStream).toHaveBeenCalled();
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

    it('handles render failure', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockRenderClip.mockImplementation(() => {
        throw new Error('FFmpeg render failed');
      });

      await handleMessage(msg, db, s3, 'clipper', logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
      expect(mockCleanupFile).toHaveBeenCalled();
    });
  });
});
