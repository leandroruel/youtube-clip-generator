import { execSync, type ExecSyncOptions } from 'node:child_process';
import { config } from './config.js';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  fullText: string;
  language: string;
}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperOutput {
  text: string;
  segments: WhisperSegment[];
  language: string;
}

const execOptions: ExecSyncOptions = {
  stdio: 'pipe',
  timeout: 600_000,
};

export function getModelPath(): string {
  return `${config.WHISPER_MODEL_DIR}/${config.WHISPER_MODEL}`;
}

export function transcribeAudio(audioPath: string): TranscriptionResult {
  const modelPath = getModelPath();
  const languageFlag = config.WHISPER_LANGUAGE !== 'auto'
    ? `-l ${config.WHISPER_LANGUAGE}`
    : '';

  const output = execSync(
    `${config.WHISPER_BIN} ` +
    `-m "${modelPath}" ` +
    `-f "${audioPath}" ` +
    `--output-json ` +
    `--print-progress ` +
    `${languageFlag} ` +
    `-of "${audioPath}"`,
    { ...execOptions, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
  );

  const parsed = JSON.parse(output) as WhisperOutput;

  return {
    segments: parsed.segments.map((s: WhisperSegment) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    })),
    fullText: parsed.text,
    language: parsed.language,
  };
}

export function cleanupFile(filePath: string) {
  try {
    execSync(`rm -f "${filePath}"`, { stdio: 'ignore' });
  } catch {
    // ignore cleanup errors
  }
}
