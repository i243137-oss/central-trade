import dotenv from 'dotenv';

// Load variables from a local .env file (if present) into process.env.
// Safe to call in every entry point (backend server, tests, etc.) — it
// never overrides variables that are already set in the real environment.
dotenv.config();

// Validate required MONGODB_URI at import time
if (!process.env.MONGODB_URI) {
  console.error(
    '[CTS Config] FATAL: MongoDB connection string is not configured.\n' +
    'Please set MONGODB_URI in the environment.\n' +
    'Example: MONGODB_URI=mongodb://localhost:27017/central-trade'
  );
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'cts_academic_jwt_secret_2007_spec',
  jwtExpiresIn: '24h',
  defaultUserBalance: 50000.0,
  outdatedSweepIntervalMs: 60 * 1000, // 1 minute background sweep
  mongoUri: process.env.MONGODB_URI
};

export default config;
