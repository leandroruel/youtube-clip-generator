import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(() => ({})),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('@clipper/storage', () => ({
  getObject: vi.fn(),
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { transcribeAudio, cleanupFile, type TranscriptSegment } from './transcriber.js';
import { config } from './config.js';

const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('transcribeAudio', () => {
  it('calls whisper-cli with correct arguments', () => {
    mockExecSync.mockReturnValue(JSON.stringify({
      text: 'Hello world',
      segments: [
        { start: 0, end: 2, text: ' Hello world ' },
      ],
      language: 'en',
    }));

    const result = transcribeAudio('/tmp/audio.opus');

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining(config.WHISPER_BIN),
      expect.objectContaining({ encoding: 'utf-8' }),
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining(`-m "${config.WHISPER_MODEL_DIR}/${config.WHISPER_MODEL}"`),
      expect.any(Object),
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('-f "/tmp/audio.opus"'),
      expect.any(Object),
    );

    expect(result.fullText).toBe('Hello world');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toEqual({ start: 0, end: 2, text: 'Hello world' });
    expect(result.language).toBe('en');
  });

  it('passes language flag when set', () => {
    const originalLang = config.WHISPER_LANGUAGE;
    Object.defineProperty(config, 'WHISPER_LANGUAGE', { value: 'pt', configurable: true });

    mockExecSync.mockReturnValue(JSON.stringify({
      text: 'Olá mundo',
      segments: [{ start: 0, end: 1.5, text: ' Olá mundo ' }],
      language: 'pt',
    }));

    transcribeAudio('/tmp/audio.opus');

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('-l pt'),
      expect.any(Object),
    );

    Object.defineProperty(config, 'WHISPER_LANGUAGE', { value: originalLang, configurable: true });
  });

  it('omits language flag for auto detection', () => {
    mockExecSync.mockReturnValue(JSON.stringify({
      text: 'Hello',
      segments: [{ start: 0, end: 1, text: ' Hello ' }],
      language: 'en',
    }));

    transcribeAudio('/tmp/audio.opus');

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.not.stringContaining('-l '),
      expect.any(Object),
    );
  });

  it('trims whitespace from segment text', () => {
    mockExecSync.mockReturnValue(JSON.stringify({
      text: '  Test  ',
      segments: [{ start: 0, end: 1, text: '  Test  ' }],
      language: 'en',
    }));

    const result = transcribeAudio('/tmp/audio.opus');

    expect(result.segments[0]!.text).toBe('Test');
  });

  it('throws when whisper-cli fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('whisper-cli not found');
    });

    expect(() => transcribeAudio('/tmp/audio.opus')).toThrow('whisper-cli not found');
  });
});

describe('cleanupFile', () => {
  it('calls rm -f with file path', () => {
    mockExecSync.mockReturnValue('');

    cleanupFile('/tmp/file.opus');

    expect(mockExecSync).toHaveBeenCalledWith(
      'rm -f "/tmp/file.opus"',
      { stdio: 'ignore' },
    );
  });

  it('does not throw on error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('rm failed');
    });

    expect(() => cleanupFile('/tmp/file.opus')).not.toThrow();
  });
});
