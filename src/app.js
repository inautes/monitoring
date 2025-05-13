import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

import BrowserService from './services/browser.js';
import DatabaseService from './models/database.js';
import ScreenshotService from './services/screenshot.js';
import FTPService from './services/ftp.js';
import CrawlerService from './services/crawler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

console.log('환경 변수 확인:');
console.log('FILEIS_URL:', process.env.FILEIS_URL);
console.log('FILEIS_USERNAME 존재 여부:', !!process.env.FILEIS_USERNAME);
console.log('FILEIS_PASSWORD 존재 여부:', !!process.env.FILEIS_PASSWORD);

const dataDir = path.join(__dirname, '../data');
const screenshotsDir = path.join(__dirname, '../screenshots');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const config = {
  site: {
    id: 'fileis',
    name: 'FileIs',
    type: 'SITE0010',
    equ: 15, // 1+2+4+8 (ID, Uploader, Title, Size)
    loginUrl: 'https://fileis.com/',
    username: process.env.FILEIS_USERNAME,
    password: process.env.FILEIS_PASSWORD
  },
  browser: {
    headless: process.env.HEADLESS !== 'false',
    timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10)
  },
  database: {
    path: process.env.DB_PATH || path.join(__dirname, '../data/monitoring.db')
  },
  ftp: {
    host: process.env.FTP_HOST || 'ftp.example.com',
    port: parseInt(process.env.FTP_PORT || '21', 10),
    user: process.env.FTP_USER || 'username',
    password: process.env.FTP_PASSWORD || 'password',
    basePath: process.env.FTP_BASE_PATH || '/images'
  },
  keyword: process.env.TARGET_KEYWORD || '폭싹속았수다'
};

class MonitoringApp {
  constructor(config) {
    this.config = config;
    this.databaseService = new DatabaseService(config.database.path);
    this.browserService = new BrowserService(config.browser);
    this.ftpService = new FTPService(config.ftp);
    this.screenshotService = new ScreenshotService(this.browserService);
    this.crawlerService = new CrawlerService(
      this.browserService,
      this.databaseService,
      this.screenshotService,
      this.ftpService
    );
  }

  async initialize() {
    console.log('Initializing Laon Monitoring System...');
    
    try {
      await this.databaseService.initialize();
      console.log('Database initialized');
    } catch (error) {
      console.error('데이터베이스 초기화 오류:', error.message);
      throw new Error('데이터베이스 초기화 실패');
    }
    
    console.log('사이트 인증 정보:', {
      username: this.config.site.username ? '설정됨' : '미설정',
      password: this.config.site.password ? '설정됨' : '미설정'
    });
    
    this.databaseService.saveOSPInfo({
      siteId: this.config.site.id || '',
      siteName: this.config.site.name || '',
      siteType: this.config.site.type || '',
      siteEqu: this.config.site.equ !== undefined ? this.config.site.equ : 0,
      loginId: this.config.site.username || '',
      loginPw: this.config.site.password || ''
    });
    console.log('OSP information saved');
    
    try {
      await this.browserService.initialize();
      console.log('Browser initialized');
    } catch (error) {
      console.error('브라우저 초기화 오류:', error.message);
      console.error('브라우저 초기화 재시도에도 실패했습니다. 네트워크 연결을 확인해주세요.');
      throw new Error('브라우저 초기화 실패');
    }
    
    try {
      await this.screenshotService.initialize();
      console.log('Screenshot service initialized');
    } catch (error) {
      console.error('스크린샷 서비스 초기화 오류:', error.message);
      console.log('스크린샷 서비스 없이 계속 진행합니다.');
    }
    
    if (process.env.DISABLE_FTP !== 'true') {
      try {
        await this.ftpService.connect().catch(error => {
          console.log(`FTP 연결 실패, 계속 진행: ${error.message}`);
          process.env.DISABLE_FTP = 'true'; // 런타임에 FTP 비활성화
        });
        console.log('FTP service initialized');
      } catch (error) {
        console.log(`FTP 초기화 오류, 계속 진행: ${error.message}`);
        process.env.DISABLE_FTP = 'true'; // 런타임에 FTP 비활성화
      }
    } else {
      console.log('FTP 서비스 비활성화됨');
    }
    
    try {
      await this.crawlerService.initialize();
      console.log('Crawler initialized');
    } catch (error) {
      console.error('크롤러 초기화 오류:', error.message);
      throw new Error('크롤러 초기화 실패');
    }
    
    console.log('Initialization complete');
  }

  async run() {
    console.log('Starting Laon Monitoring System...');
    
    try {
      await this.initialize();
      
      console.log(`Logging in to ${this.config.site.name} (${this.config.site.loginUrl})...`);
      const loginSuccess = await this.browserService.login(
        this.config.site.loginUrl,
        {
          username: this.config.site.username,
          password: this.config.site.password
        }
      );
      
      if (!loginSuccess) {
        throw new Error('Login failed');
      }
      
      console.log('Login successful');
      
      const categories = {
        MOVIE: 'CG001',
        DRAMA: 'CG002',
        VIDEO: 'CG003',
        ANIME: 'CG005'
      };
      
      const pageCount = this.config.pageCount || 2;
      console.log(`Page count per category: ${pageCount}`);
      
      for (const [categoryName, categoryCode] of Object.entries(categories)) {
        console.log(`Processing category: ${categoryName} (${categoryCode})`);
        const results = await this.crawlerService.crawlCategory(categoryCode, pageCount);
        console.log(`Processed ${results.length} content items in category ${categoryName}`);
      }
      
      console.log(`Searching for keyword: ${this.config.keyword}`);
      
      try {
        const keywordResults = await this.crawlerService.searchByKeyword(this.config.keyword);
        console.log(`Found ${keywordResults.length} results for keyword: ${this.config.keyword}`);
        
        for (const result of keywordResults) {
          console.log(`Found content with keyword: ${result.title}`);
        }
      } catch (error) {
        console.error(`Error searching for keyword: ${error.message}`);
      }
      
      console.log('Monitoring completed successfully');
    } catch (error) {
      console.error('Error running monitoring system:', error);
    } finally {
      if (this.browserService) {
        await this.browserService.close();
      }
      
      if (this.databaseService) {
        this.databaseService.close();
      }
      
      if (this.ftpService) {
        await this.ftpService.disconnect();
      }
      
      console.log('Monitoring system shutdown complete');
    }
  }
}

const app = new MonitoringApp(config);

if (import.meta.url === `file://${process.argv[1]}`) {
  app.run().catch(console.error);
}

export default MonitoringApp;
