import { app } from './app.js';
import { unifiedConfig } from './core/config/unifiedConfig.js';
import { closeDb } from './core/db/index.js';
import { closeRedisClient } from './core/redis/index.js';
import { documentProcessingQueue } from './features/processing/queue.js';
import { startDocumentWorker } from './features/processing/worker.js';

const { port } = unifiedConfig.server;

const worker = startDocumentWorker();
worker.on('error', (err) => {
  console.error('[DocuMind Worker] Redis/Worker error:', err.message);
});

const server = app.listen(port, () => {
  console.log(`[DocuMind Server] running on http://localhost:${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await Promise.allSettled([
    worker.close(),
    documentProcessingQueue.close(),
    closeRedisClient(),
    closeDb(),
  ]);
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
