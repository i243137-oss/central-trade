import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// Load .env for dev server so MONGODB_URI is available before config.js validates
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'cts-api-middleware',
        async configureServer(server) {
          // Dynamically import server modules after dotenv is loaded
          const { app } = await import('./server/app.js');
          const dbManager = (await import('./server/services/database/ManagementOfDatabase.js')).default;
          const { seedDatabase } = await import('./server/seed/seedData.js');
          const { startOutdatedInstructionJob } = await import('./server/jobs/outdatedInstructionJob.js');

          // Connect to MongoDB (required — no fallback)
          try {
            await dbManager.connectMongo();
            await seedDatabase(false);
            startOutdatedInstructionJob();
          } catch (err) {
            console.error('[CTS Vite Dev] FATAL: MongoDB connection failed:', err.message);
            console.error('[CTS Vite Dev] The application requires MongoDB. Please set MONGODB_URI and ensure MongoDB is running.');
            process.exit(1);
          }

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
