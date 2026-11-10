import { serve } from '@hono/node-server';
import { createSproutApp } from './app.js';

const PORT = Number(process.env.PORT ?? process.env.SPROUT_PORT ?? 4120);
const HOST = process.env.SPROUT_HOST ?? (process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1');
const DB_PATH = process.env.SPROUT_DB_PATH ?? './data/sprout.db';

const { app } = createSproutApp({
  dbPath: DB_PATH,
  serveStaticClient: true,
});

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  },
  (info) => {
    console.log(
      `[Sprout Core] Self-hosted server listening at http://${info.address}:${info.port} (DB: ${DB_PATH})`
    );
  }
);
