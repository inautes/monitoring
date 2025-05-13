/**
 * Secure configuration utility
 * Handles sensitive configuration without exposing values in code
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Get site configuration without exposing sensitive information
 * @returns {Object} Site configuration
 */
export const getSiteConfig = () => {
  return {
    id: process.env.FILEIS_ID || 'fileis',
    name: process.env.FILEIS_NAME || 'FileIs',
    type: process.env.FILEIS_TYPE || 'SITE0010',
    equ: process.env.FILEIS_EQU ? parseInt(process.env.FILEIS_EQU, 10) : 15,
    loginUrl: process.env.FILEIS_URL || 'https://fileis.com/'
  };
};

/**
 * Get browser configuration
 * @returns {Object} Browser configuration
 */
export const getBrowserConfig = () => {
  return {
    headless: process.env.HEADLESS === 'true',
    timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10)
  };
};

/**
 * Get database configuration
 * @returns {Object} Database configuration
 */
export const getDatabaseConfig = () => {
  return {
    path: process.env.DB_PATH || './data/monitoring.db'
  };
};

/**
 * Get FTP configuration
 * @returns {Object} FTP configuration
 */
export const getFtpConfig = () => {
  return {
    host: process.env.FTP_HOST || 'localhost',
    port: parseInt(process.env.FTP_PORT || '21', 10),
    user: process.env.FTP_USER || 'anonymous',
    password: '********', // Masked for security
    basePath: process.env.FTP_BASE_PATH || '/uploads'
  };
};

/**
 * Get monitoring configuration
 * @returns {Object} Monitoring configuration
 */
export const getMonitoringConfig = () => {
  return {
    keyword: process.env.TARGET_KEYWORD || ''
  };
};

/**
 * Get target keyword safely
 * @returns {string} The target keyword
 */
export const getTargetKeyword = () => {
  return process.env.TARGET_KEYWORD || '';
};

/**
 * Get authentication credentials
 * For internal use only - never log or expose these values
 * @returns {Object} Authentication credentials
 */
export const getAuthCredentials = () => {
  return {
    username: process.env.FILEIS_USERNAME,
    password: process.env.FILEIS_PASSWORD
  };
};

export default {
  getSiteConfig,
  getBrowserConfig,
  getDatabaseConfig,
  getFtpConfig,
  getMonitoringConfig
};
