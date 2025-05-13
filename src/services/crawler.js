import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class CrawlerService {
  constructor(browserService, databaseService, screenshotService, ftpService) {
    this.browserService = browserService;
    this.databaseService = databaseService;
    this.screenshotService = screenshotService;
    this.ftpService = ftpService;
    
    this.categories = {
      MOVIE: 'CG001',
      DRAMA: 'CG002',
      VIDEO: 'CG003',
      ANIME: 'CG005'
    };
    
    this.categoryNames = {
      'CG001': '영화',
      'CG002': '드라마',
      'CG003': '동영상 및 방송',
      'CG005': '애니'
    };
    
    this.targetKeyword = '폭싹속았수다';
    this.outputDir = path.join(__dirname, '../../data/screenshots');
  }

  async initialize() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    return this;
  }

  async crawlCategory(category, pages = 1) {
    console.log(`Crawling category: ${this.categoryNames[category]} (${category})`);
    
    try {
      const navigationSuccess = await this.browserService.navigateToCategory(category);
      if (!navigationSuccess) {
        console.error(`Failed to navigate to category: ${category}`);
        return [];
      }
      
      const processedContents = [];
      
      for (let page = 1; page <= pages; page++) {
        console.log(`Processing page ${page} of ${pages}`);
        
        const contentList = await this.browserService.getContentList(null, page);
        console.log(`Found ${contentList.length} content items on page ${page}`);
        
        if (contentList.length === 0) {
          console.log(`No content items found on page ${page}, skipping to next page`);
          continue;
        }
        
        const contentWithSelectors = await this.addSelectorsToContent(contentList);
        
        for (const content of contentWithSelectors) {
          const processedContent = await this.processContent(content, category);
          if (processedContent) {
            processedContents.push(processedContent);
          }
        }
        
        if (page < pages) {
          const nextPageSuccess = await this.goToNextPage(page);
          if (!nextPageSuccess) {
            console.log(`No more pages available, ending pagination at page ${page}`);
            break;
          }
        }
      }
      
      return processedContents;
    } catch (error) {
      console.error(`Error crawling category ${category}:`, error);
      return [];
    }
  }
  
  async addSelectorsToContent(contentList) {
    try {
      const selectors = await this.browserService.page.evaluate(() => {
        const itemSelectors = [
          '.content-item', '.list-item', '.board-item', 'tr.item', '.file-item',
          '.list_table tr', '.board_list tr', '.file_list li', '.content_list li',
          '.list-table tr', '.content-list-item', '.file-list-item'
        ];
        
        let items = [];
        
        for (const selector of itemSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements && elements.length > 0) {
            items = Array.from(elements);
            break;
          }
        }
        
        return items.map((item, index) => {
          const clickableElements = item.querySelectorAll('a, .title, .subject, .name, .filename');
          let clickableSelector = null;
          
          if (clickableElements && clickableElements.length > 0) {
            const element = clickableElements[0];
            const classes = Array.from(element.classList).join('.');
            
            if (classes) {
              clickableSelector = `${element.tagName.toLowerCase()}.${classes}`;
            } else {
              const parentSelector = item.tagName.toLowerCase();
              clickableSelector = `${parentSelector}:nth-child(${index + 1}) ${element.tagName.toLowerCase()}`;
            }
          } else {
            const classes = Array.from(item.classList).join('.');
            if (classes) {
              clickableSelector = `${item.tagName.toLowerCase()}.${classes}`;
            } else {
              clickableSelector = `${item.tagName.toLowerCase()}:nth-child(${index + 1})`;
            }
          }
          
          return {
            selector: clickableSelector,
            index: index
          };
        });
      });
      
      return contentList.map((content, index) => {
        if (index < selectors.length) {
          return {
            ...content,
            selector: selectors[index].selector,
            index: selectors[index].index
          };
        }
        return content;
      });
    } catch (error) {
      console.error(`Error adding selectors to content: ${error.message}`);
      return contentList; // 오류 발생 시 원래 목록 반환
    }
  }
  
  async goToNextPage(currentPage) {
    try {
      console.log(`Attempting to navigate to page ${currentPage + 1}`);
      
      const nextPageClicked = await this.browserService.page.evaluate((page) => {
        const nextPageSelectors = [
          `.pagination a[href*="page=${page + 1}"]`,
          `.pagination a[href*="page_no=${page + 1}"]`,
          `.pagination a[href*="pageNo=${page + 1}"]`,
          `.pagination a[href*="pageIndex=${page + 1}"]`,
          `.pagination .next`,
          `.pagination .next-page`,
          `.paging .next`,
          `.paging a[href*="page=${page + 1}"]`,
          `a.next`,
          `a[aria-label="Next page"]`,
          `.board_paging a:nth-child(${page + 1})`,
          `.board_paging a:contains("${page + 1}")`,
          `.paging a:contains("${page + 1}")`
        ];
        
        for (const selector of nextPageSelectors) {
          const nextButton = document.querySelector(selector);
          if (nextButton) {
            nextButton.click();
            return true;
          }
        }
        
        const pageLinks = document.querySelectorAll('.pagination a, .paging a, .board_paging a');
        for (const link of pageLinks) {
          if (link.textContent.trim() === String(page + 1)) {
            link.click();
            return true;
          }
        }
        
        return false;
      }, currentPage);
      
      if (nextPageClicked) {
        await this.browserService.page.waitForNavigation({ 
          waitUntil: 'networkidle2',
          timeout: this.browserService.config.timeout 
        }).catch(() => {
          console.log('Navigation timeout, but continuing anyway');
        });
        
        await this.browserService.page.waitForSelector('.list_table, .board_list, .file_list, .content_list', { 
          timeout: this.browserService.config.timeout 
        }).catch(() => {
          console.log('Content list selector timeout, but continuing anyway');
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error navigating to next page: ${error.message}`);
      return false;
    }
  }

  async processContent(content, category) {
    try {
      console.log(`Processing content: ${content.title}`);
      
      const containsKeyword = content.title.includes(this.targetKeyword);
      console.log(`Contains keyword "${this.targetKeyword}": ${containsKeyword}`);
      
      const now = new Date();
      const regDate = now.toISOString();
      const crawlId = this.databaseService.generateCrawlId('fileis', content.contentId, regDate);
      
      const existingContent = this.databaseService.getContentByCrawlId(crawlId);
      if (existingContent) {
        console.log(`Content already exists with crawl ID: ${crawlId}`);
        return null;
      }
      
      const listingScreenshotPath = path.join(this.outputDir, `listing_${crawlId}.png`);
      await this.browserService.captureScreenshot('.list_table', listingScreenshotPath);
      
      const detailInfo = await this.browserService.getContentDetail(content);
      if (!detailInfo) {
        console.error(`Failed to get detail information for content: ${content.title}`);
        return null;
      }
      
      const detailScreenshotPath = path.join(this.outputDir, `detail_${crawlId}.png`);
      await this.browserService.captureScreenshot('.content_detail', detailScreenshotPath);
      
      const utck3ScreenshotPath = path.join(this.outputDir, `utck3_${crawlId}.png`);
      await this.screenshotService.captureUTCK3(utck3ScreenshotPath);
      
      const evidenceImagePath = path.join(this.outputDir, `evidence_${crawlId}.png`);
      await this.screenshotService.composeEvidenceImage(
        listingScreenshotPath,
        detailScreenshotPath,
        utck3ScreenshotPath,
        evidenceImagePath
      );
      
      let remotePath = '';
      try {
        remotePath = this.ftpService.generateRemotePath(`evidence_${crawlId}.png`);
        
        await this.ftpService.uploadFile(evidenceImagePath, remotePath).catch(error => {
          console.log(`FTP 업로드 오류, 계속 진행: ${error.message}`);
          remotePath = evidenceImagePath; // 로컬 경로를 대신 사용
        });
      } catch (error) {
        console.log(`FTP 경로 생성 오류, 로컬 경로 사용: ${error.message}`);
        remotePath = evidenceImagePath; // 로컬 경로를 대신 사용
      }
      
      const contentInfo = {
        crawlId,
        siteId: 'fileis',
        contentId: content.contentId,
        title: content.title,
        genre: category,
        fileCount: detailInfo.fileList ? detailInfo.fileList.length : 0,
        fileSize: detailInfo.fileSize || content.fileSize,
        uploaderId: detailInfo.uploaderId || content.uploaderId,
        collectionTime: regDate,
        detailUrl: content.detailUrl
      };
      
      this.databaseService.saveContentInfo(contentInfo);
      
      const contentDetailInfo = {
        crawlId,
        collectionTime: regDate,
        price: detailInfo.price || '',
        priceUnit: detailInfo.priceUnit || '',
        partnershipStatus: detailInfo.partnershipStatus || 'U',
        captureFilename: remotePath, // FTP 업로드 실패 시 로컬 경로 사용
        status: containsKeyword ? 'KEYWORD_FOUND' : 'NORMAL'
      };
      
      this.databaseService.saveContentDetailInfo(contentDetailInfo);
      
      if (detailInfo.fileList && detailInfo.fileList.length > 0) {
        this.databaseService.saveFileList(crawlId, detailInfo.fileList);
      }
      
      console.log(`Successfully processed content: ${content.title}`);
      return {
        ...contentInfo,
        ...contentDetailInfo,
        containsKeyword
      };
    } catch (error) {
      console.error(`Error processing content ${content.title}:`, error);
      return null;
    }
  }

  async searchByKeyword(keyword = null) {
    const searchKeyword = keyword || this.targetKeyword;
    console.log(`Searching for keyword: ${searchKeyword}`);
    
    try {
      const searchResults = await this.browserService.searchKeyword(searchKeyword);
      console.log(`Found ${searchResults.length} results for keyword: ${searchKeyword}`);
      
      const processedResults = [];
      for (const result of searchResults) {
        const category = this.determineCategory(result);
        
        const processedResult = await this.processContent(result, category);
        if (processedResult) {
          processedResults.push(processedResult);
        }
      }
      
      return processedResults;
    } catch (error) {
      console.error(`Error searching for keyword ${searchKeyword}:`, error);
      return [];
    }
  }

  determineCategory(content) {
    if (content.detailUrl) {
      if (content.detailUrl.includes('category1=MVO')) return 'CG001';
      if (content.detailUrl.includes('category1=DRA')) return 'CG002';
      if (content.detailUrl.includes('category1=VDO')) return 'CG003';
      if (content.detailUrl.includes('category1=ANI')) return 'CG005';
    }
    
    return 'CG001';
  }
}

export default CrawlerService;
