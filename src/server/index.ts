import { serve } from '@hono/node-server';
import { createMarmaladeApp } from './app.js';
import { resolveDefaultDbPath } from './db/sqlite.js';

const PORT = Number(
  process.env.MARMALADE_PORT ?? process.env.PORT ?? process.env.SPROUT_PORT ?? 4120
);
const HOST =
  process.env.MARMALADE_HOST ??
  process.env.SPROUT_HOST ??
  (process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1');
const DB_PATH =
  process.env.MARMALADE_DB_PATH ??
  process.env.SPROUT_DB_PATH ??
  resolveDefaultDbPath();

const { app } = createMarmaladeApp({
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
      `[Marmalade] Self-hosted server listening at http://${info.address}:${info.port} (DB: ${DB_PATH})`
    );
  }
);
