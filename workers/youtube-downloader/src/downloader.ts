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

export function getYouTubeMetadata(url: string): YouTubeMetadata {
  const output = execSync(
    `yt-dlp --dump-json --no-download --skip-download "${url}"`,
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
    `yt-dlp ` +
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

export function cleanupAudio(filePath: string) {
  try {
    execSync(`rm -f "${filePath}"`, { stdio: 'ignore' });
  } catch {
    // ignore cleanup errors
  }
}
