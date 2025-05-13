class MockBrowserService {
  constructor(config) {
    this.config = config || {
      headless: true,
      timeout: 30000
    };
    this.isInitialized = false;
    this.isLoggedIn = false;
  }

  async initialize() {
    console.log('Mock browser initialized');
    this.isInitialized = true;
    return this;
  }

  async login(url, credentials) {
    console.log(`Mock login to ${url}`);
    this.isLoggedIn = true;
    return true;
  }

  async navigateToCategory(category) {
    console.log(`Mock navigate to category: ${category}`);
    return true;
  }

  async getContentList(category, pageNum = 1) {
    console.log(`Mock get content list for category: ${category}, page: ${pageNum}`);
    
    const mockList = [];
    for (let i = 0; i < 10; i++) {
      mockList.push({
        contentId: `${category}_${i}`,
        title: `Mock content ${i} ${Math.random() < 0.2 ? '폭싹속았수다' : ''}`,
        detailUrl: `/detail/${category}_${i}`,
        fileSize: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9) + 1}GB`,
        uploaderId: `uploader${Math.floor(Math.random() * 900) + 100}`
      });
    }
    
    return mockList;
  }

  async getContentDetail(url) {
    console.log(`Mock get content detail for URL: ${url}`);
    
    return {
      title: `Mock content detail ${Math.random() < 0.2 ? '폭싹속았수다' : ''}`,
      fileSize: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9) + 1}GB`,
      price: `${Math.floor(Math.random() * 1500) + 500}`,
      priceUnit: '포인트',
      uploaderId: `uploader${Math.floor(Math.random() * 900) + 100}`,
      partnershipStatus: Math.random() < 0.3 ? 'Y' : 'N',
      fileList: [
        { filename: 'mock_file1.mp4', fileSize: '1.2GB' },
        { filename: 'mock_file2.mp4', fileSize: '2.3GB' }
      ]
    };
  }

  async searchKeyword(keyword) {
    console.log(`Mock search for keyword: ${keyword}`);
    
    const mockResults = [];
    for (let i = 0; i < 5; i++) {
      mockResults.push({
        contentId: `search_${i}`,
        title: `Search result ${i} ${keyword}`,
        detailUrl: `/detail/search_${i}`,
        fileSize: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9) + 1}GB`,
        uploaderId: `uploader${Math.floor(Math.random() * 900) + 100}`
      });
    }
    
    return mockResults;
  }

  async captureScreenshot(selector, outputPath) {
    console.log(`Mock capture screenshot of ${selector} to ${outputPath}`);
    return outputPath;
  }

  async close() {
    console.log('Mock browser closed');
    this.isInitialized = false;
    this.isLoggedIn = false;
  }
}

export default MockBrowserService;
