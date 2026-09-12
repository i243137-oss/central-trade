import path from 'path';
import express from 'express';
import { app } from './app.js';
import config from './config/config.js';
import dbManager from './services/database/ManagementOfDatabase.js';
import { seedDatabase } from './seed/seedData.js';
import { startOutdatedInstructionJob } from './jobs/outdatedInstructionJob.js';

async function startServer() {
  try {
    // 0. Connect to MongoDB if available
    await dbManager.connectMongo();

    // 1. Seed database with initial academic demonstration data
    await seedDatabase(false);

    // 2. Start background worker for sweeping outdated instructions (SRS R05)
    startOutdatedInstructionJob();

    // 3. Serve frontend static build if running in production
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    // For client-side routing, route unmatched non-API paths to index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
          next();
        }
      });
    });

    // 4. Start HTTP listener
    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`[CTS Server] Central Trading System running on port ${config.port}`);
      console.log(`[CTS Server] Health check available at http://localhost:${config.port}/api/health`);
    });

    return server;
  } catch (err) {
    console.error('[CTS Server] Fatal startup error:', err);
    process.exit(1);
  }
}

// Start if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { startServer };
export default startServer;
