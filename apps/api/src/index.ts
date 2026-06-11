import { buildApp } from './app.js';
import { env } from './config/env.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server listening on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }
}

main();
