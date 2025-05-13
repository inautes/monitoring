import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getSiteConfig,
  getBrowserConfig,
  getDatabaseConfig,
  getFtpConfig,
  getMonitoringConfig
} from '../utils/secureConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const requiredEnvVars = [
  'FILEIS_URL',
  'TARGET_KEYWORD'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file and make sure all required variables are set.');
  process.exit(1);
}

const config = {
  site: getSiteConfig(),
  browser: getBrowserConfig(),
  database: getDatabaseConfig(),
  ftp: getFtpConfig(),
  keyword: getMonitoringConfig().keyword
};

export default config;
