import express from 'express';
import authRoutes from './routes/authRoutes.js';
import instructionRoutes from './routes/instructionRoutes.js';
import matchingRoutes from './routes/matchingRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import queryRoutes from './routes/queryRoutes.js';
import managerRoutes from './routes/managerRoutes.js';
import dbManager from './services/database/ManagementOfDatabase.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger for CTS audits
  app.use((req, res, next) => {
    // Only log non-static API requests
    if (req.path.startsWith('/api/')) {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        if (res.statusCode >= 400) {
          console.warn(`[CTS API] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
        }
      });
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      system: 'Central Trading System (CTS)',
      version: '1.0 (2007 SRS Specification)',
      timestamp: new Date().toISOString(),
      operationsSuspended: dbManager.isOperationsSuspended()
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/instructions', instructionRoutes);
  app.use('/api/matching', matchingRoutes);
  app.use('/api/stocks', stockRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/queries', queryRoutes);
  app.use('/api/trades', queryRoutes);
  app.use('/api/manager', managerRoutes);

  // Centralized Error Handling Middleware (R08 Capacity & R09 Maintainability)
  app.use((err, req, res, next) => {
    console.error('[CTS Express Error Handler]:', err);
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Internal Central Trading System error.',
      errorCode: err.errorCode || 'INTERNAL_ERROR'
    });
  });

  return app;
}

export const app = createApp();
export default app;
