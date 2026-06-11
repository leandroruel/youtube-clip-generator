export const VideoSource = {
  YOUTUBE: 'youtube',
  UPLOAD: 'upload',
} as const;

export type VideoSource = (typeof VideoSource)[keyof typeof VideoSource];
