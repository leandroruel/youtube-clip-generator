import { createLogger } from '@clipper/logger';

const logger = createLogger('temporal');

async function main() {
  logger.info('Temporal worker starting');
}

main().catch((err) => {
  logger.fatal(err, 'Fatal error');
});
