import { execSync, type ExecSyncOptions } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { config } from './config.js';

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export function generateSRT(segments: SubtitleSegment[]): string {
  return segments.map((seg, i) => {
    const start = formatTime(seg.start);
    const end = formatTime(seg.end);
    return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
  }).join('\n');
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(Math.floor(s))},${pad(ms, 3)}`;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export interface BurnResult {
  outputPath: string;
}

export function burnSubtitles(
  inputVideo: string,
  subtitlePath: string,
  outputPath: string,
): BurnResult {
  execSync(
    `ffmpeg -y ` +
    `-i "${inputVideo}" ` +
    `-vf "subtitles='${subtitlePath}':force_style='FontName=DejaVu Sans Bold,FontSize=18,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=1,Outline=1,Shadow=1'" ` +
    `-c:a copy ` +
    `"${outputPath}"`,
    { ...execOptions, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
  );

  return { outputPath };
}

export function writeSRTFile(segments: SubtitleSegment[], filePath: string): void {
  const content = generateSRT(segments);
  writeFileSync(filePath, content, 'utf-8');
}

export function cleanupFile(filePath: string) {
  try {
    execSync(`rm -f "${filePath}"`, { stdio: 'ignore' });
  } catch {
    // ignore cleanup errors
  }
}

const execOptions: ExecSyncOptions = {
  stdio: 'pipe',
  timeout: 600_000,
};
