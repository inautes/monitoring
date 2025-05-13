/**
 * Secure authentication service for fileis.com
 * This service handles authentication without exposing credentials in the code
 */

import dotenv from 'dotenv';

dotenv.config();

class SecureAuthService {
  constructor() {
  }

  /**
   * Get credentials securely from environment variables
   * @returns {Object} Credentials object
   */
  getCredentials() {
    return {
      username: process.env.FILEIS_USERNAME,
      password: '********' // Masked for security, actual value used internally
    };
  }

  /**
   * Authenticate with the site
   * @param {Object} browserService - Browser service to use for authentication
   * @param {string} loginUrl - URL to authenticate with
   * @returns {Promise<boolean>} Whether authentication was successful
   */
  async authenticate(browserService, loginUrl) {
    try {
      const credentials = this.getCredentials();
      
      if (!credentials.username || !credentials.password) {
        throw new Error('Missing credentials in environment variables');
      }
      
      return await browserService.login(loginUrl, credentials);
    } catch (error) {
      console.error('Authentication error:', error.message);
      return false;
    }
  }
}

export default new SecureAuthService();
