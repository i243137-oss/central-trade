export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'cts_academic_jwt_secret_2007_spec',
  jwtExpiresIn: '24h',
  defaultUserBalance: 50000.0,
  outdatedSweepIntervalMs: 60 * 1000, // 1 minute background sweep
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cts'
};

export default config;
