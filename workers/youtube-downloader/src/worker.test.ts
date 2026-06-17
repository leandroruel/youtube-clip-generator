import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => ({ pipe: vi.fn() })),
}));

vi.mock('@clipper/storage', () => ({
  uploadStream: vi.fn(),
}));

vi.mock('./downloader.js', () => ({
  getYouTubeMetadata: vi.fn(),
  downloadAudio: vi.fn(),
  cleanupAudio: vi.fn(),
}));

import { handleMessage, type NatsMsg, type DB } from './worker.js';
import { getYouTubeMetadata, downloadAudio, cleanupAudio } from './downloader.js';
import { uploadStream } from '@clipper/storage';

const mockGetYouTubeMetadata = vi.mocked(getYouTubeMetadata);
const mockDownloadAudio = vi.mocked(downloadAudio);
const mockCleanupAudio = vi.mocked(cleanupAudio);
const mockUploadStream = vi.mocked(uploadStream);

function mockDb() {
  const whereUpdateJobStatus = vi.fn().mockResolvedValue(undefined);

  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: whereUpdateJobStatus,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'video-1' }]),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  } as unknown as DB;
}

function mockS3() {
  return { send: vi.fn() } as never;
}

function mockJs() {
  return { publish: vi.fn() } as never;
}

function mockNatsMsg(overrides?: Partial<NatsMsg>): NatsMsg {
  return {
    ack: vi.fn(),
    term: vi.fn(),
    data: new TextEncoder().encode(JSON.stringify({
      jobId: 'job-1',
      projectId: 'proj-1',
      videoId: 'video-1',
      youtubeUrl: 'https://youtube.com/watch?v=abc123',
    })),
    ...overrides,
  };
}

function mockLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn(), trace: vi.fn(), silent: vi.fn(), child: vi.fn(), level: 'info', levels: {}, bindings: vi.fn(), flush: vi.fn(), isLevelEnabled: vi.fn() } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUploadStream.mockResolvedValue(undefined as never);
});

describe('handleMessage', () => {
  describe('success path', () => {
    it('processes a YouTube download job end-to-end', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const bucket = 'clipper';
      const logger = mockLogger();

      mockGetYouTubeMetadata.mockReturnValue({
        id: 'abc123',
        title: 'Test Video',
        duration: 3600,
        thumbnail: 'https://example.com/thumb.jpg',
      });

      mockDownloadAudio.mockReturnValue({
        filePath: '/tmp/abc123.opus',
        metadata: {
          id: 'abc123',
          title: 'Test Video',
          duration: 3600,
          thumbnail: 'https://example.com/thumb.jpg',
        },
      });

      const js = mockJs();
      await handleMessage(msg, db, s3, bucket, js, logger);

      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
      expect(mockGetYouTubeMetadata).toHaveBeenCalledWith('https://youtube.com/watch?v=abc123');
      expect(mockDownloadAudio).toHaveBeenCalledWith('https://youtube.com/watch?v=abc123', 'abc123');
      expect(msg.ack).toHaveBeenCalled();
      expect(msg.term).not.toHaveBeenCalled();
      expect(mockCleanupAudio).toHaveBeenCalledWith('/tmp/abc123.opus');
    });

    it('parses payload from message data', async () => {
      const data = JSON.stringify({ jobId: 'j-1', projectId: 'p-1', youtubeUrl: 'https://example.com/video' });
      const msg = mockNatsMsg({ data: new TextEncoder().encode(data) });
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockGetYouTubeMetadata.mockReturnValue({ id: 'a', title: 'T', duration: 10, thumbnail: '' });
      mockDownloadAudio.mockReturnValue({ filePath: '/tmp/a.opus', metadata: { id: 'a', title: 'T', duration: 10, thumbnail: '' } });

      const js = mockJs();
      await handleMessage(msg, db, s3, 'clipper', js, logger);

      expect(mockGetYouTubeMetadata).toHaveBeenCalledWith('https://example.com/video');
    });

    it('updates job processing status on start', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockGetYouTubeMetadata.mockReturnValue({ id: 'a', title: 'T', duration: 10, thumbnail: '' });
      mockDownloadAudio.mockReturnValue({ filePath: '/tmp/a.opus', metadata: { id: 'a', title: 'T', duration: 10, thumbnail: '' } });

      const js = mockJs();
      await handleMessage(msg, db, s3, 'clipper', js, logger);

      expect(db.update).toHaveBeenCalled();
    });

    it('inserts a video record', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockGetYouTubeMetadata.mockReturnValue({ id: 'a', title: 'My Podcast', duration: 7200, thumbnail: 'https://example.com/thumb.jpg' });
      mockDownloadAudio.mockReturnValue({ filePath: '/tmp/a.opus', metadata: { id: 'a', title: 'My Podcast', duration: 7200, thumbnail: 'https://example.com/thumb.jpg' } });

      const js = mockJs();
      await handleMessage(msg, db, s3, 'clipper', js, logger);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('failure paths', () => {
    it('handles metadata fetch failure', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockGetYouTubeMetadata.mockImplementation(() => {
        throw new Error('Invalid YouTube URL');
      });

      const js = mockJs();
      await handleMessage(msg, db, s3, 'clipper', js, logger);

      expect(db.update).toHaveBeenCalled();
      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('handles video insert failure', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      const insertReturning = vi.fn().mockResolvedValue([]);
      const insertValues = vi.fn(() => ({ returning: insertReturning }));
      vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

      mockGetYouTubeMetadata.mockReturnValue({ id: 'a', title: 'T', duration: 10, thumbnail: '' });
      mockDownloadAudio.mockReturnValue({ filePath: '/tmp/a.opus', metadata: { id: 'a', title: 'T', duration: 10, thumbnail: '' } });

      const js = mockJs();
      await handleMessage(msg, db, s3, 'clipper', js, logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('cleans up temp file on S3 upload failure', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockUploadStream.mockRejectedValue(new Error('S3 upload failed'));

      mockGetYouTubeMetadata.mockReturnValue({ id: 'a', title: 'T', duration: 10, thumbnail: '' });
      mockDownloadAudio.mockReturnValue({ filePath: '/tmp/a.opus', metadata: { id: 'a', title: 'T', duration: 10, thumbnail: '' } });

      const js = mockJs();
      await handleMessage(msg, db, s3, 'clipper', js, logger);

      expect(mockCleanupAudio).toHaveBeenCalledWith('/tmp/a.opus');
      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });

    it('terms failed messages', async () => {
      const msg = mockNatsMsg();
      const db = mockDb();
      const s3 = mockS3();
      const logger = mockLogger();

      mockGetYouTubeMetadata.mockImplementation(() => {
        throw new Error('Network error');
      });

      const js = mockJs();
      await handleMessage(msg, db, s3, 'clipper', js, logger);

      expect(msg.term).toHaveBeenCalled();
      expect(msg.ack).not.toHaveBeenCalled();
    });
  });
});
