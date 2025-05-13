import MonitoringApp from '../app.js';
import config from '../config/index.js';
import secureAuth from '../services/secureAuth.js';

class MonitoringController {
  constructor() {
    this.monitoringApp = null;
    this.isRunning = false;
    this.status = {
      isInitialized: false,
      isLoggedIn: false,
      currentActivity: 'Idle',
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      results: [],
      errors: [],
      startTime: null,
      endTime: null,
      categories: {
        'CG001': 0,
        'CG002': 0,
        'CG003': 0,
        'CG005': 0
      },
      keywordFound: 0,
      recentActivity: []
    };
    
    this.startMonitoring = this.startMonitoring.bind(this);
    this.stopMonitoring = this.stopMonitoring.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.getResults = this.getResults.bind(this);
    this.getCategories = this.getCategories.bind(this);
    this.getContentList = this.getContentList.bind(this);
    this.getContentDetail = this.getContentDetail.bind(this);
    this.searchByKeyword = this.searchByKeyword.bind(this);
  }
  
  async startMonitoring(req, res) {
    if (this.isRunning) {
      return res.status(400).json({
        success: false,
        message: '모니터링이 이미 실행 중입니다.'
      });
    }
    
    try {
      const stealthMode = req.body.stealthMode !== undefined ? req.body.stealthMode : true;
      const pageCount = req.body.pageCount || 2;
      
      console.log(`모니터링 옵션: 스텔스 모드=${stealthMode}, 페이지 수=${pageCount}`);
      
      this.status = {
        isInitialized: false,
        isLoggedIn: false,
        currentActivity: 'Starting monitoring',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        results: [],
        errors: [],
        startTime: new Date().toISOString(),
        endTime: null,
        categories: {
          'CG001': 0,
          'CG002': 0,
          'CG003': 0,
          'CG005': 0
        },
        keywordFound: 0,
        recentActivity: [],
        options: {
          stealthMode,
          pageCount
        }
      };
      
      this.isRunning = true;
      
      const monitoringConfig = {
        ...config,
        browser: {
          ...config.browser,
          headless: stealthMode
        },
        pageCount: pageCount
      };
      
      this.monitoringApp = new MonitoringApp(monitoringConfig);
      
      this.runMonitoring();
      
      res.json({
        success: true,
        message: '모니터링이 시작되었습니다.',
        status: this.status
      });
    } catch (error) {
      this.isRunning = false;
      this.status.errors.push(error.message);
      
      res.status(500).json({
        success: false,
        message: '모니터링 시작 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }
  
  async stopMonitoring(req, res) {
    if (!this.isRunning) {
      return res.status(400).json({
        success: false,
        message: '실행 중인 모니터링이 없습니다.'
      });
    }
    
    try {
      this.isRunning = false;
      this.status.currentActivity = 'Stopping monitoring';
      
      if (this.monitoringApp) {
        if (this.monitoringApp.browserService) {
          await this.monitoringApp.browserService.close();
        }
        
        if (this.monitoringApp.databaseService) {
          this.monitoringApp.databaseService.close();
        }
        
        if (this.monitoringApp.ftpService) {
          await this.monitoringApp.ftpService.disconnect();
        }
      }
      
      this.status.currentActivity = 'Idle';
      this.status.endTime = new Date().toISOString();
      
      res.json({
        success: true,
        message: '모니터링이 중지되었습니다.',
        status: this.status
      });
    } catch (error) {
      this.status.errors.push(error.message);
      
      res.status(500).json({
        success: false,
        message: '모니터링 중지 중 오류가 발생했습니다.',
        error: error.message
      });
    } finally {
      this.isRunning = false;
    }
  }
  
  async runMonitoring() {
    try {
      this.status.currentActivity = 'Initializing services';
      await this.monitoringApp.initialize();
      this.status.isInitialized = true;
      this.addActivityLog('서비스 초기화 완료');
      
      this.status.currentActivity = 'Logging in';
      // Use secure authentication service
      const loginSuccess = await secureAuth.authenticate(
        this.monitoringApp.browserService,
        this.monitoringApp.config.site.loginUrl
      );
      
      if (!loginSuccess) {
        throw new Error('Login failed');
      }
      
      this.status.isLoggedIn = true;
      this.addActivityLog('로그인 성공');
      
      const categories = {
        MOVIE: 'CG001',
        DRAMA: 'CG002',
        VIDEO: 'CG003',
        ANIME: 'CG005'
      };
      
      const categoryNames = {
        'CG001': '영화',
        'CG002': '드라마',
        'CG003': '동영상 및 방송',
        'CG005': '애니'
      };
      
      this.status.totalItems = Object.keys(categories).length + 1; // +1 for keyword search
      
      const pageCount = this.monitoringApp.config.pageCount || 2;
      const totalPages = Object.keys(categories).length * pageCount + 1; // +1 for keyword search
      let processedPages = 0;
      
      for (const [categoryName, categoryCode] of Object.entries(categories)) {
        if (!this.isRunning) break;
        
        this.status.currentActivity = `Crawling ${categoryName}`;
        this.addActivityLog(`카테고리 ${categoryNames[categoryCode]} 스캔 시작 (${pageCount}페이지)`);
        
        let allResults = [];
        
        for (let page = 1; page <= pageCount; page++) {
          if (!this.isRunning) break;
          
          this.status.currentActivity = `Crawling ${categoryName} - Page ${page}/${pageCount}`;
          
          const results = await this.monitoringApp.crawlerService.crawlCategory(categoryCode, page);
          allResults = [...allResults, ...results];
          
          processedPages++;
          this.status.progress = (processedPages / totalPages) * 100;
          
          this.addActivityLog(`카테고리 ${categoryNames[categoryCode]} - ${page}/${pageCount} 페이지 스캔 완료, ${results.length}개 컨텐츠 발견`);
        }
        
        this.status.categories[categoryCode] = allResults.length;
        this.status.results = [...this.status.results, ...allResults];
        
        const keywordMatches = allResults.filter(item => item.containsKeyword).length;
        this.status.keywordFound += keywordMatches;
        
        this.addActivityLog(`카테고리 ${categoryNames[categoryCode]} 스캔 완료, ${allResults.length}개 컨텐츠 발견, ${keywordMatches}개 키워드 매칭`);
      }
      
      if (this.isRunning) {
        this.status.currentActivity = `Searching for keyword`;
        this.addActivityLog(`키워드 검색 시작`);
        
        const keywordResults = await this.monitoringApp.crawlerService.searchByKeyword();
        
        const existingCrawlIds = this.status.results.map(item => item.crawlId);
        const newResults = keywordResults.filter(item => !existingCrawlIds.includes(item.crawlId));
        
        this.status.results = [...this.status.results, ...newResults];
        this.status.keywordFound += newResults.length;
        this.status.processedItems++;
        this.status.progress = (this.status.processedItems / this.status.totalItems) * 100;
        
        this.addActivityLog(`키워드 검색 완료: ${keywordResults.length}개 결과 발견`);
      }
      
      this.status.currentActivity = 'Monitoring completed';
      this.status.progress = 100;
      this.status.endTime = new Date().toISOString();
      
      this.addActivityLog('모니터링 완료');
    } catch (error) {
      this.status.errors.push(error.message);
      this.status.currentActivity = `Error: ${error.message}`;
      this.addActivityLog(`오류 발생: ${error.message}`);
    } finally {
      if (this.monitoringApp) {
        if (this.monitoringApp.browserService) {
          await this.monitoringApp.browserService.close();
        }
        
        if (this.monitoringApp.databaseService) {
          this.monitoringApp.databaseService.close();
        }
        
        if (this.monitoringApp.ftpService) {
          await this.monitoringApp.ftpService.disconnect();
        }
      }
      
      this.isRunning = false;
    }
  }
  
  addActivityLog(activity) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.status.recentActivity.unshift({
      timestamp,
      action: activity,
      results: ''
    });
    
    if (this.status.recentActivity.length > 10) {
      this.status.recentActivity.pop();
    }
  }
  
  getStatus(req, res) {
    res.json({
      success: true,
      isRunning: this.isRunning,
      status: this.status
    });
  }
  
  async getResults(req, res) {
    try {
      let results = [];
      
      if (this.monitoringApp && this.monitoringApp.databaseService) {
        if (this.monitoringApp.databaseService.db) {
          results = this.monitoringApp.databaseService.getAllContent() || [];
        } else {
          results = this.status.results;
        }
      } else {
        results = this.status.results;
      }
      
      res.json({
        success: true,
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '결과 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }
  
  getCategories(req, res) {
    const categories = [
      { id: 'CG001', name: '영화', count: this.status.categories['CG001'] },
      { id: 'CG002', name: '드라마', count: this.status.categories['CG002'] },
      { id: 'CG003', name: '동영상 및 방송', count: this.status.categories['CG003'] },
      { id: 'CG005', name: '애니', count: this.status.categories['CG005'] }
    ];
    
    res.json({
      success: true,
      categories
    });
  }
  
  async getContentList(req, res) {
    const categoryId = req.params.id;
    
    try {
      let contentList = [];
      
      if (this.status.results.length > 0) {
        contentList = this.status.results.filter(item => item.genre === categoryId);
      }
      
      res.json({
        success: true,
        contentList
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '컨텐츠 목록 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }
  
  async getContentDetail(req, res) {
    const contentId = req.params.id;
    
    try {
      const content = this.status.results.find(item => item.crawlId === contentId);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: '컨텐츠를 찾을 수 없습니다.'
        });
      }
      
      res.json({
        success: true,
        content
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '컨텐츠 상세 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }
  
  async searchByKeyword(req, res) {
    const keyword = req.query.keyword || '';
    
    try {
      let results = [];
      
      if (keyword) {
        results = this.status.results.filter(item => 
          item.title.includes(keyword)
        );
      }
      
      res.json({
        success: true,
        keyword,
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '검색 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }
}

export default new MonitoringController();
