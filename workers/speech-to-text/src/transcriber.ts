import { execSync, type ExecSyncOptions } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
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
  modelName: string;
}

interface WhisperOffsets {
  from: number;
  to: number;
}

interface WhisperTranscriptionItem {
  offsets: WhisperOffsets;
  text: string;
}

interface WhisperResult {
  language: string;
}

interface WhisperOutput {
  text?: string;
  transcription: WhisperTranscriptionItem[];
  result: WhisperResult;
}

const execOptions: ExecSyncOptions = {
  stdio: 'pipe',
  timeout: 1_800_000,
};

export function getModelPath(): string {
  return `${config.WHISPER_MODEL_DIR}/${config.WHISPER_MODEL}`;
}

function toWav(inputPath: string, wavPath: string) {
  execSync(
    `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 "${wavPath}"`,
    { stdio: 'ignore', timeout: 60_000 },
  );
}

export function transcribeAudio(audioPath: string): TranscriptionResult {
  const modelPath = getModelPath();
  const languageFlag = config.WHISPER_LANGUAGE !== 'auto'
    ? `-l ${config.WHISPER_LANGUAGE}`
    : '';

  const wavPath = `${audioPath}.wav`;
  toWav(audioPath, wavPath);

  const jsonOutputPath = `${wavPath}.json`;

  execSync(
    `${config.WHISPER_BIN} ` +
    `-m "${modelPath}" ` +
    `-f "${wavPath}" ` +
    `--output-json ` +
    `--print-progress ` +
    `${languageFlag} ` +
    `-of "${wavPath}"`,
    { ...execOptions, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
  );

  const raw = readFileSync(jsonOutputPath, 'utf-8');
  const parsed = JSON.parse(raw) as WhisperOutput;
  unlinkSync(jsonOutputPath);
  unlinkSync(wavPath);

  return {
    segments: parsed.transcription.map((s) => ({
      start: s.offsets.from / 1000,
      end: s.offsets.to / 1000,
      text: s.text.trim(),
    })),
    fullText: parsed.transcription.map((s) => s.text.trim()).join(' ').trim(),
    language: parsed.result.language,
    modelName: config.WHISPER_MODEL.replace(/^ggml-|\.bin$/g, ''),
  };
}

export function cleanupFile(filePath: string) {
  try {
    execSync(`rm -f "${filePath}" "${filePath}.wav"`, { stdio: 'ignore' });
  } catch {
    // ignore cleanup errors
  }
}
