import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  createReadStream: vi.fn(() => ({ pipe: vi.fn() })),
  createWriteStream: vi.fn(() => ({})),
}));

import { execSync } from 'node:child_process';
import { generateSRT, writeSRTFile, cleanupFile, type SubtitleSegment } from './subtitler.js';

const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateSRT', () => {
  it('generates SRT format from segments', () => {
    const segments: SubtitleSegment[] = [
      { start: 0, end: 2.5, text: 'Hello world' },
      { start: 3, end: 5.5, text: 'This is a test' },
    ];

    const srt = generateSRT(segments);

    expect(srt).toContain('1');
    expect(srt).toContain('00:00:00,000 --> 00:00:02,500');
    expect(srt).toContain('Hello world');
    expect(srt).toContain('2');
    expect(srt).toContain('00:00:03,000 --> 00:00:05,500');
    expect(srt).toContain('This is a test');
  });

  it('handles single segment', () => {
    const segments: SubtitleSegment[] = [
      { start: 1.5, end: 4.2, text: 'Only one' },
    ];

    const srt = generateSRT(segments);

    expect(srt).toContain('00:00:01,500 --> 00:00:04,200');
    expect(srt).toContain('Only one');
  });
});

describe('cleanupFile', () => {
  it('calls rm -f with file path', () => {
    mockExecSync.mockReturnValue('');

    cleanupFile('/tmp/file.srt');

    expect(mockExecSync).toHaveBeenCalledWith(
      'rm -f "/tmp/file.srt"',
      { stdio: 'ignore' },
    );
  });

  it('does not throw on error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('rm failed');
    });

    expect(() => cleanupFile('/tmp/file.srt')).not.toThrow();
  });
});
