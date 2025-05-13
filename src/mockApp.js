import MockBrowserService from './services/mockBrowser.js';
import config from './config/index.js';
import secureAuth from './services/secureAuth.js';

class MockMonitoringApp {
  constructor(config) {
    this.config = config;
    this.browserService = new MockBrowserService(config.browser);
    
    this.crawlerService = {
      crawlCategory: this.crawlCategory.bind(this),
      searchByKeyword: this.searchByKeyword.bind(this)
    };
  }
  
  async initialize() {
    console.log('Initializing Mock Monitoring System...');
    await this.browserService.initialize();
    console.log('Mock initialization complete');
  }
  
  async run() {
    console.log('Starting Mock Monitoring System...');
    
    try {
      await this.initialize();
      
      console.log(`Logging in to site...`);
      // Use secure authentication service
      const loginSuccess = await secureAuth.authenticate(
        this.browserService,
        this.config.site.loginUrl
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
      
      for (const [categoryName, categoryCode] of Object.entries(categories)) {
        console.log(`Processing category: ${categoryName} (${categoryCode})`);
        const results = await this.crawlCategory(categoryCode, 1);
        console.log(`Processed ${results.length} content items in category ${categoryName}`);
      }
      
      console.log(`Searching for keyword`);
      // Use secure method without direct reference to sensitive config
      const keywordResults = await this.searchByKeyword();
      console.log(`Found ${keywordResults.length} results for keyword search`);
      
      console.log('Monitoring completed successfully');
    } catch (error) {
      console.error('Error running monitoring system:', error);
    } finally {
      if (this.browserService) {
        await this.browserService.close();
      }
      
      console.log('Monitoring system shutdown complete');
    }
  }
  
  async crawlCategory(categoryCode, page = 1) {
    await this.browserService.navigateToCategory(categoryCode);
    const contentList = await this.browserService.getContentList(categoryCode, page);
    
    const results = [];
    for (const content of contentList) {
      const targetKeyword = process.env.TARGET_KEYWORD || '';
      const containsKeyword = content.title.includes(targetKeyword);
      
      results.push({
        crawlId: content.contentId,
        title: content.title,
        genre: categoryCode,
        uploaderId: content.uploaderId,
        fileSize: content.fileSize,
        uploadDate: new Date().toISOString().split('T')[0],
        price: Math.floor(Math.random() * 1500) + 500,
        priceUnit: '포인트',
        partnershipStatus: Math.random() < 0.3 ? 'Y' : 'N',
        fileList: [
          { name: `file1_${content.contentId}.mp4`, size: '1.2GB' },
          { name: `file2_${content.contentId}.mp4`, size: '2.3GB' }
        ],
        captureFilename: `/screenshots/${content.contentId}.png`,
        status: containsKeyword ? 'KEYWORD_FOUND' : 'CLEAN',
        containsKeyword,
        detailUrl: `/detail/${content.contentId}`
      });
    }
    
    return results;
  }
  
  async searchByKeyword() {
    const keyword = process.env.TARGET_KEYWORD || '';
    const searchResults = await this.browserService.searchKeyword(keyword);
    
    const results = [];
    for (const content of searchResults) {
      results.push({
        crawlId: content.contentId,
        title: content.title,
        genre: 'SEARCH',
        uploaderId: content.uploaderId,
        fileSize: content.fileSize,
        uploadDate: new Date().toISOString().split('T')[0],
        price: Math.floor(Math.random() * 1500) + 500,
        priceUnit: '포인트',
        partnershipStatus: Math.random() < 0.3 ? 'Y' : 'N',
        fileList: [
          { name: `file1_${content.contentId}.mp4`, size: '1.2GB' },
          { name: `file2_${content.contentId}.mp4`, size: '2.3GB' }
        ],
        captureFilename: `/screenshots/${content.contentId}.png`,
        status: 'KEYWORD_FOUND',
        containsKeyword: true,
        detailUrl: `/detail/${content.contentId}`
      });
    }
    
    return results;
  }
}

const app = new MockMonitoringApp(config);

if (import.meta.url === `file://${process.argv[1]}`) {
  app.run().catch(console.error);
}

export default MockMonitoringApp;
