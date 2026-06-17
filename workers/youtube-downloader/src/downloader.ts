import { execSync, type ExecSyncOptions } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';

export interface YouTubeMetadata {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
}

export interface DownloadResult {
  filePath: string;
  metadata: YouTubeMetadata;
}

const execOptions: ExecSyncOptions = {
  stdio: 'pipe',
  timeout: 600_000,
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const COMMON_FLAGS = [
  '--no-update',
  `--user-agent "${USER_AGENT}"`,
  '--throttled-rate 100K',
].join(' ');

export function getYouTubeMetadata(url: string): YouTubeMetadata {
  const cmd = `yt-dlp ${COMMON_FLAGS} --dump-json --no-download --skip-download "${url}"`;
  try {
    const output = execSync(
      cmd,
      { ...execOptions, encoding: 'utf-8', maxBuffer: 1024 * 1024 },
    );

    const data = JSON.parse(output) as {
      id: string;
      title: string;
      duration: number;
      thumbnail: string;
    };

    return {
      id: data.id,
      title: data.title,
      duration: data.duration,
      thumbnail: data.thumbnail,
    };
  } catch (err) {
    if (err instanceof Error && 'stderr' in err) {
      const enriched = new Error(`yt-dlp failed: ${err.message}\nSTDERR: ${(err as any).stderr}\nCMD: ${cmd}`);
      enriched.stack = err.stack;
      throw enriched;
    }
    if (err instanceof Error && err.message) {
      const enriched = new Error(`yt-dlp failed: ${err.message}\nCMD: ${cmd}`);
      enriched.stack = err.stack;
      throw enriched;
    }
    throw err;
  }
}

export function downloadAudio(url: string, videoId: string): DownloadResult {
  mkdirSync(config.DOWNLOAD_DIR, { recursive: true });

  const outputTemplate = join(config.DOWNLOAD_DIR, `${videoId}.%(ext)s`);

  const format = config.AUDIO_FORMAT === 'opus'
    ? 'bestaudio[ext=webm]/bestaudio'
    : 'bestaudio';

  const extractAudio = config.AUDIO_FORMAT !== 'opus'
    ? `--extract-audio --audio-format ${config.AUDIO_FORMAT}`
    : '';

  const output = execSync(
    `yt-dlp ${COMMON_FLAGS} ` +
    `-f "${format}" ` +
    `${extractAudio} ` +
    `--audio-quality ${config.AUDIO_QUALITY} ` +
    `-o "${outputTemplate}" ` +
    `--no-playlist ` +
    `--print after_move:filepath ` +
    `"${url}"`,
    { ...execOptions, encoding: 'utf-8', maxBuffer: 1024 * 1024 },
  );

  const filePath = output.trim().split('\n').pop() ?? '';

  return { filePath, metadata: getYouTubeMetadata(url) };
}

export function downloadVideoPreview(url: string, videoId: string): DownloadResult {
  mkdirSync(config.DOWNLOAD_DIR, { recursive: true });

  const outputTemplate = join(config.DOWNLOAD_DIR, `${videoId}_preview.%(ext)s`);

  // Download best video up to 720p with audio, merge to mp4 for consistent format
  const output = execSync(
    `yt-dlp ${COMMON_FLAGS} ` +
    `-f "best[height<=720]" ` +
    `--merge-output-format mp4 ` +
    `-o "${outputTemplate}" ` +
    `--no-playlist ` +
    `--print after_move:filepath ` +
    `"${url}"`,
    { ...execOptions, encoding: 'utf-8', maxBuffer: 1024 * 1024 },
  );

  const filePath = output.trim().split('\n').pop() ?? '';

  return { filePath, metadata: getYouTubeMetadata(url) };
}

export function cleanupAudio(filePath: string) {
  try {
    execSync(`rm -f "${filePath}"`, { stdio: 'ignore' });
  } catch {
    // ignore cleanup errors
  }
}
