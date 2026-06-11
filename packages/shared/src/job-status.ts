export const JobStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
