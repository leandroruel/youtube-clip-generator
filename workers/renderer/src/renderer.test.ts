import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { renderClip, cleanupFile } from './renderer.js';

const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderClip', () => {
  it('builds ffmpeg command with crop and scale', () => {
    mockExecSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce('30.5,5120000\n');

    const result = renderClip('/tmp/input.mp4', '/tmp/output.mp4', 10, 20, {
      x: 656, y: 0, width: 608, height: 1080, confidence: 0.7,
    });

    const cmd = mockExecSync.mock.calls[0]![0] as string;

    expect(cmd).toContain('ffmpeg');
    expect(cmd).toContain('-ss 10');
    expect(cmd).toContain('-i "/tmp/input.mp4"');
    expect(cmd).toContain('-t 20');
    expect(cmd).toContain('crop=608:1080:656:0');
    expect(cmd).toContain('scale=608:1080');
    expect(cmd).toContain('"/tmp/output.mp4"');

    expect(result.duration).toBe(30.5);
    expect(result.fileSize).toBe(5120000);
  });

  it('renders without crop params', () => {
    mockExecSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce('10,1000000\n');

    const result = renderClip('/tmp/input.mp4', '/tmp/output.mp4', 0, 15);

    const cmd = mockExecSync.mock.calls[0]![0] as string;
    expect(cmd).not.toContain('crop=');
    expect(result.outputPath).toBe('/tmp/output.mp4');
  });

  it('throws when ffmpeg fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('ffmpeg not found');
    });

    expect(() => renderClip('/tmp/input.mp4', '/tmp/output.mp4', 0, 10))
      .toThrow('ffmpeg not found');
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
