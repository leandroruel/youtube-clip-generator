export const JobType = {
  YOUTUBE_DOWNLOAD: 'youtube_download',
  SPEECH_TO_TEXT: 'speech_to_text',
  CLIP_ANALYSIS: 'clip_analysis',
  FACE_TRACKING: 'face_tracking',
  SUBTITLE_GENERATION: 'subtitle_generation',
  RENDER: 'render',
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];
