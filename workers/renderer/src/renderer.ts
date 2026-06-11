import { execSync, type ExecSyncOptions } from 'node:child_process';
import { config } from './config.js';

export interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface RenderResult {
  outputPath: string;
  duration: number;
  fileSize: number;
}

const execOptions: ExecSyncOptions = {
  stdio: 'pipe',
  timeout: 600_000,
};

export function renderClip(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  crop?: CropParams,
): RenderResult {
  const cropFilter = crop
    ? `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},`
    : '';

  const scaleFilter = `${cropFilter}scale=${config.OUTPUT_WIDTH}:${config.OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${config.OUTPUT_WIDTH}:${config.OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2`;

  const cmd =
    `ffmpeg -y ` +
    `-ss ${startTime} ` +
    `-i "${inputPath}" ` +
    `-t ${duration} ` +
    `-vf "${scaleFilter}" ` +
    `-c:v libx264 ` +
    `-b:v ${config.RENDER_VIDEO_BITRATE} ` +
    `-c:a aac ` +
    `-b:a ${config.RENDER_AUDIO_BITRATE} ` +
    `-movflags +faststart ` +
    `"${outputPath}"`;

  execSync(cmd, { ...execOptions, encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });

  const probeOutput = execSync(
    `ffprobe -v error -show_entries format=duration,size -of csv=p=0 "${outputPath}"`,
    { ...execOptions, encoding: 'utf-8' },
  );

  const [durationOut, sizeStr] = probeOutput.trim().split(',');
  const fileSize = Number(sizeStr);

  return {
    outputPath,
    duration: Number(durationOut),
    fileSize: Number.isNaN(fileSize) ? 0 : fileSize,
  };
}

export function cleanupFile(filePath: string) {
  try {
    execSync(`rm -f "${filePath}"`, { stdio: 'ignore' });
  } catch {
    // ignore cleanup errors
  }
}
