import { connect, consumerOpts, type NatsConnection } from 'nats';

export const JOB_STREAM = 'jobs';
export const JOB_SUBJECT_PREFIX = 'job';

export async function createNatsConnection(url: string): Promise<NatsConnection> {
  return connect({ servers: url });
}

export async function ensureJobStream(nc: NatsConnection) {
  const jsm = await nc.jetstreamManager();
  try {
    await jsm.streams.add({
      name: JOB_STREAM,
      subjects: [`${JOB_SUBJECT_PREFIX}.>`],
      retention: 'workqueue',
      storage: 'file',
      discard: 'old',
      max_consumers: -1,
      max_msgs_per_subject: -1,
    } as any);
  } catch {
    // stream already exists
  }
}

export function subjectForJobType(jobType: string): string {
  return `${JOB_SUBJECT_PREFIX}.${jobType}`;
}

export { consumerOpts };
