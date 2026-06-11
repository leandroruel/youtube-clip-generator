export const ProjectStatus = {
  CREATED: 'created',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
