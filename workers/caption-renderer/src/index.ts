import { createNatsConnection } from '@clipper/queue';
import { createLogger } from '@clipper/logger';
import { config } from './config.js';
import { startWorker } from './worker.js';

const logger = createLogger('caption-renderer');

async function main() {
  logger.info('Caption Renderer worker starting');

  const nc = await createNatsConnection(config.NATS_URL);
  logger.info('Connected to NATS');

  nc.closed().then(() => {
    logger.info('NATS connection closed');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Shutting down');
    await nc.drain();
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down');
    await nc.drain();
  });

  await startWorker(nc, logger);
}

main().catch((err) => {
  logger.fatal(err, 'Fatal error');
  process.exit(1);
});
