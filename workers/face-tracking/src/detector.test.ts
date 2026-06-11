import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { detectCrop, cleanupFile } from './detector.js';

const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('detectCrop', () => {
  it('returns center crop for 16:9 landscape source to 9:16 portrait', () => {
    mockExecSync.mockReturnValue('1920,1080\n');

    const result = detectCrop('/tmp/video.mp4', 608, 1080);

    expect(result.width).toBe(608);
    expect(result.height).toBe(1080);
    expect(result.x).toBe(656);
    expect(result.y).toBe(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('returns full width crop for portrait source', () => {
    mockExecSync.mockReturnValue('1080,1920\n');

    const result = detectCrop('/tmp/video.mp4', 608, 1080);

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1918);
  });

  it('throws when ffprobe fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('ffprobe not found');
    });

    expect(() => detectCrop('/tmp/video.mp4', 608, 1080)).toThrow('ffprobe not found');
  });
});

describe('cleanupFile', () => {
  it('calls rm -f with file path', () => {
    mockExecSync.mockReturnValue('');

    cleanupFile('/tmp/file.mp4');

    expect(mockExecSync).toHaveBeenCalledWith(
      'rm -f "/tmp/file.mp4"',
      { stdio: 'ignore' },
    );
  });

  it('does not throw on error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('rm failed');
    });

    expect(() => cleanupFile('/tmp/file.mp4')).not.toThrow();
  });
});
