import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { app } from './server/app.js';
import dbManager from './server/services/database/ManagementOfDatabase.js';
import { seedDatabase } from './server/seed/seedData.js';
import { startOutdatedInstructionJob } from './server/jobs/outdatedInstructionJob.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'cts-api-middleware',
        configureServer(server) {
          // In dev mode, attempt Mongo connection, seed database and run background sweep
          dbManager.connectMongo().finally(() => {
            seedDatabase(false);
            startOutdatedInstructionJob();
          });

          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/api')) {
              app(req, res, next);
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
