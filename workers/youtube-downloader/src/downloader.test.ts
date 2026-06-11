import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { getYouTubeMetadata, downloadAudio, cleanupAudio } from './downloader.js';
import { config } from './config.js';

const mockExecSync = vi.mocked(execSync);
const mockMkdirSync = vi.mocked(mkdirSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getYouTubeMetadata', () => {
  it('parses yt-dlp JSON output', () => {
    mockExecSync.mockReturnValue(JSON.stringify({
      id: 'abc123',
      title: 'Test Video',
      duration: 3600,
      thumbnail: 'https://example.com/thumb.jpg',
    }));

    const result = getYouTubeMetadata('https://youtube.com/watch?v=abc123');

    expect(result).toEqual({
      id: 'abc123',
      title: 'Test Video',
      duration: 3600,
      thumbnail: 'https://example.com/thumb.jpg',
    });

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('yt-dlp --dump-json'),
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('passes the URL to yt-dlp', () => {
    mockExecSync.mockReturnValue(JSON.stringify({
      id: 'xyz',
      title: 'T',
      duration: 0,
      thumbnail: '',
    }));

    getYouTubeMetadata('https://youtube.com/watch?v=xyz');

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('https://youtube.com/watch?v=xyz'),
      expect.any(Object),
    );
  });

  it('throws when yt-dlp fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('yt-dlp not found');
    });

    expect(() => getYouTubeMetadata('https://youtube.com/watch?v=bad'))
      .toThrow('yt-dlp not found');
  });
});

describe('downloadAudio', () => {
  it('creates download directory', () => {
    mockExecSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce(JSON.stringify({ id: 'abc', title: 'T', duration: 100, thumbnail: '' }));

    downloadAudio('https://youtube.com/watch?v=abc', 'abc');

    expect(mockMkdirSync).toHaveBeenCalledWith(config.DOWNLOAD_DIR, { recursive: true });
  });

  it('builds correct opus command', () => {
    mockExecSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce(JSON.stringify({ id: 'abc', title: 'T', duration: 100, thumbnail: '' }));

    downloadAudio('https://youtube.com/watch?v=abc', 'abc');

    const command = mockExecSync.mock.calls[0]![0] as string;
    expect(command).toContain('yt-dlp');
    expect(command).toContain('-f "bestaudio[ext=webm]/bestaudio"');
    expect(command).toContain('--audio-quality 0');
    expect(command).toContain(`-o "${config.DOWNLOAD_DIR}/abc.%(ext)s"`);
    expect(command).toContain('--no-playlist');
    expect(command).toContain('https://youtube.com/watch?v=abc');
  });

  it('builds correct mp3 command when format is not opus', async () => {
    const originalFormat = config.AUDIO_FORMAT;
    Object.defineProperty(config, 'AUDIO_FORMAT', { value: 'mp3', configurable: true });

    mockExecSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce(JSON.stringify({ id: 'abc', title: 'T', duration: 100, thumbnail: '' }));

    downloadAudio('https://youtube.com/watch?v=abc', 'abc');

    const command = mockExecSync.mock.calls[0]![0] as string;
    expect(command).toContain('--extract-audio');
    expect(command).toContain('--audio-format mp3');

    Object.defineProperty(config, 'AUDIO_FORMAT', { value: originalFormat, configurable: true });
  });

  it('calls getYouTubeMetadata and returns file path', () => {
    mockExecSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce(JSON.stringify({
        id: 'abc',
        title: 'T',
        duration: 100,
        thumbnail: '',
      }));

    const result = downloadAudio('https://youtube.com/watch?v=abc', 'abc');

    expect(result.filePath).toBe(`${config.DOWNLOAD_DIR}/abc.${config.AUDIO_FORMAT}`);
    expect(result.metadata).toBeDefined();
  });
});

describe('cleanupAudio', () => {
  it('calls rm -f with file path', () => {
    mockExecSync.mockReturnValue('');

    cleanupAudio('/tmp/file.opus');

    expect(mockExecSync).toHaveBeenCalledWith(
      'rm -f "/tmp/file.opus"',
      { stdio: 'ignore' },
    );
  });

  it('does not throw on error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('rm failed');
    });

    expect(() => cleanupAudio('/tmp/file.opus')).not.toThrow();
  });
});
