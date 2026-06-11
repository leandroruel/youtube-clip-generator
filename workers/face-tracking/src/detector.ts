import { execSync, type ExecSyncOptions } from 'node:child_process';

export interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

const execOptions: ExecSyncOptions = {
  stdio: 'pipe',
  timeout: 120_000,
};

export function detectCrop(videoPath: string, outputWidth: number, outputHeight: number): CropParams {
  const probeOutput = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`,
    { ...execOptions, encoding: 'utf-8' },
  );

  const [rawWidth, rawHeight] = probeOutput.trim().split(',').map(Number);
  if (!rawWidth || !rawHeight) throw new Error('Could not determine video dimensions');

  const targetAspect = outputWidth / outputHeight;
  const sourceAspect = rawWidth / rawHeight;

  let cropWidth: number;
  let cropHeight: number;

  if (sourceAspect > targetAspect) {
    cropHeight = rawHeight;
    cropWidth = Math.round(rawHeight * targetAspect);
  } else {
    cropWidth = rawWidth;
    cropHeight = Math.round(rawWidth / targetAspect);
  }

  const x = Math.round((rawWidth - cropWidth) / 2);
  const y = 0;

  return { x, y, width: cropWidth, height: cropHeight, confidence: 0.7 };
}

export function cleanupFile(filePath: string) {
  try {
    execSync(`rm -f "${filePath}"`, { stdio: 'ignore' });
  } catch {
    // ignore cleanup errors
  }
}
