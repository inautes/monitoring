import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import md5 from 'md5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '../../data/monitoring.db');
    this.db = null;
    this.SQL = null;
    this.ensureDatabaseDirectory();
  }

  ensureDatabaseDirectory() {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      const SQL = await initSqlJs();
      this.SQL = SQL;
      
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(new Uint8Array(data));
      } else {
        this.db = new SQL.Database();
      }
      
      this.createTables();
      return this;
    } catch (error) {
      console.error('데이터베이스 초기화 오류:', error);
      throw error;
    }
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS osp (
        site_id TEXT PRIMARY KEY,
        site_name TEXT NOT NULL,
        site_type TEXT NOT NULL,
        site_equ INTEGER NOT NULL,
        login_id TEXT NOT NULL,
        login_pw TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content (
        crawl_id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        title TEXT NOT NULL,
        genre TEXT NOT NULL,
        file_count INTEGER,
        file_size TEXT,
        uploader_id TEXT,
        collection_time DATETIME NOT NULL,
        detail_url TEXT NOT NULL,
        FOREIGN KEY (site_id) REFERENCES osp(site_id)
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_detail (
        crawl_id TEXT PRIMARY KEY,
        collection_time DATETIME NOT NULL,
        price TEXT,
        price_unit TEXT,
        partnership_status TEXT,
        capture_filename TEXT,
        status TEXT,
        FOREIGN KEY (crawl_id) REFERENCES content(crawl_id)
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crawl_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_size TEXT,
        FOREIGN KEY (crawl_id) REFERENCES content(crawl_id)
      );
    `);
    
    this.saveToFile();
  }

  saveToFile() {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      console.error('데이터베이스 파일 저장 오류:', error);
    }
  }

  generateCrawlId(siteId, contentId, regDate) {
    const data = `${siteId}${contentId}${regDate}`;
    return md5(data);
  }

  saveOSPInfo(ospInfo) {
    try {
      const safeOspInfo = {
        siteId: ospInfo?.siteId || '',
        siteName: ospInfo?.siteName || '',
        siteType: ospInfo?.siteType || '',
        siteEqu: ospInfo?.siteEqu !== undefined ? ospInfo.siteEqu : 0,
        loginId: ospInfo?.loginId || '',
        loginPw: ospInfo?.loginPw || ''
      };
      
      console.log('OSP 정보 저장 (안전한 값 적용):', {
        siteId: safeOspInfo.siteId,
        siteName: safeOspInfo.siteName,
        siteType: safeOspInfo.siteType,
        siteEqu: safeOspInfo.siteEqu,
        loginId: safeOspInfo.loginId ? '설정됨' : '미설정',
        loginPw: safeOspInfo.loginPw ? '설정됨' : '미설정'
      });
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO osp (site_id, site_name, site_type, site_equ, login_id, login_pw)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.bind([
        safeOspInfo.siteId,
        safeOspInfo.siteName,
        safeOspInfo.siteType,
        safeOspInfo.siteEqu,
        safeOspInfo.loginId,
        safeOspInfo.loginPw
      ]);
      
      stmt.step();
      stmt.free();
      
      this.saveToFile();
      
      return true;
    } catch (error) {
      console.error('OSP 정보 저장 오류:', error);
      return false;
    }
  }

  saveContentInfo(contentInfo) {
    try {
      const safeContentInfo = {
        crawlId: contentInfo?.crawlId || '',
        siteId: contentInfo?.siteId || '',
        contentId: contentInfo?.contentId || '',
        title: contentInfo?.title || '',
        genre: contentInfo?.genre || '',
        fileCount: contentInfo?.fileCount !== undefined ? contentInfo.fileCount : 0,
        fileSize: contentInfo?.fileSize || '',
        uploaderId: contentInfo?.uploaderId || '',
        collectionTime: contentInfo?.collectionTime || new Date().toISOString(),
        detailUrl: contentInfo?.detailUrl || ''
      };
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO content (
          crawl_id, site_id, content_id, title, genre, file_count, 
          file_size, uploader_id, collection_time, detail_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.bind([
        safeContentInfo.crawlId,
        safeContentInfo.siteId,
        safeContentInfo.contentId,
        safeContentInfo.title,
        safeContentInfo.genre,
        safeContentInfo.fileCount,
        safeContentInfo.fileSize,
        safeContentInfo.uploaderId,
        safeContentInfo.collectionTime,
        safeContentInfo.detailUrl
      ]);
      
      stmt.step();
      stmt.free();
      
      this.saveToFile();
      
      return true;
    } catch (error) {
      console.error('콘텐츠 정보 저장 오류:', error);
      return false;
    }
  }

  saveContentDetailInfo(detailInfo) {
    try {
      const safeDetailInfo = {
        crawlId: detailInfo?.crawlId || '',
        collectionTime: detailInfo?.collectionTime || new Date().toISOString(),
        price: detailInfo?.price || '',
        priceUnit: detailInfo?.priceUnit || '',
        partnershipStatus: detailInfo?.partnershipStatus || '',
        captureFilename: detailInfo?.captureFilename || '',
        status: detailInfo?.status || ''
      };
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO content_detail (
          crawl_id, collection_time, price, price_unit, 
          partnership_status, capture_filename, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.bind([
        safeDetailInfo.crawlId,
        safeDetailInfo.collectionTime,
        safeDetailInfo.price,
        safeDetailInfo.priceUnit,
        safeDetailInfo.partnershipStatus,
        safeDetailInfo.captureFilename,
        safeDetailInfo.status
      ]);
      
      stmt.step();
      stmt.free();
      
      this.saveToFile();
      
      return true;
    } catch (error) {
      console.error('콘텐츠 상세 정보 저장 오류:', error);
      return false;
    }
  }

  saveFileList(crawlId, fileList) {
    try {
      const safeCrawlId = crawlId || '';
      const safeFileList = Array.isArray(fileList) ? fileList : [];
      
      if (!safeCrawlId) {
        console.warn('파일 목록 저장 경고: crawlId가 비어 있습니다');
        return false;
      }
      
      if (safeFileList.length === 0) {
        console.log('파일 목록 저장: 파일 목록이 비어 있습니다');
        return true; // 빈 목록은 오류가 아님
      }
      
      this.db.exec('BEGIN TRANSACTION;');
      
      for (const item of safeFileList) {
        const safeItem = {
          filename: item?.filename || '',
          fileSize: item?.fileSize || ''
        };
        
        if (!safeItem.filename) {
          console.warn('파일 목록 저장 경고: 파일 이름이 비어 있는 항목 건너뜀');
          continue;
        }
        
        const stmt = this.db.prepare(`
          INSERT INTO file_list (crawl_id, filename, file_size)
          VALUES (?, ?, ?)
        `);
        
        stmt.bind([safeCrawlId, safeItem.filename, safeItem.fileSize]);
        stmt.step();
        stmt.free();
      }
      
      this.db.exec('COMMIT;');
      
      this.saveToFile();
      
      return true;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK;');
      } catch (rollbackError) {
        console.error('트랜잭션 롤백 오류:', rollbackError);
      }
      console.error('파일 목록 저장 오류:', error);
      return false;
    }
  }

  getContentByCrawlId(crawlId) {
    try {
      const query = `
        SELECT c.*, cd.*
        FROM content c
        LEFT JOIN content_detail cd ON c.crawl_id = cd.crawl_id
        WHERE c.crawl_id = '${crawlId}'
      `;
      
      const result = this.db.exec(query);
      
      if (result.length > 0 && result[0].values.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values[0];
        
        const content = {};
        columns.forEach((col, idx) => {
          content[col] = values[idx];
        });
        
        return content;
      }
      
      return null;
    } catch (error) {
      console.error('콘텐츠 조회 오류:', error);
      return null;
    }
  }

  getFileListByCrawlId(crawlId) {
    try {
      const query = `
        SELECT * FROM file_list
        WHERE crawl_id = '${crawlId}'
      `;
      
      const result = this.db.exec(query);
      
      if (result.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values;
        
        return values.map(row => {
          const item = {};
          columns.forEach((col, idx) => {
            item[col] = row[idx];
          });
          return item;
        });
      }
      
      return [];
    } catch (error) {
      console.error('파일 목록 조회 오류:', error);
      return [];
    }
  }

  getContentByKeyword(keyword) {
    try {
      const query = `
        SELECT c.*, cd.*
        FROM content c
        LEFT JOIN content_detail cd ON c.crawl_id = cd.crawl_id
        WHERE c.title LIKE '%${keyword}%'
        ORDER BY c.collection_time DESC
      `;
      
      const result = this.db.exec(query);
      
      if (result.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values;
        
        return values.map(row => {
          const item = {};
          columns.forEach((col, idx) => {
            item[col] = row[idx];
          });
          return item;
        });
      }
      
      return [];
    } catch (error) {
      console.error('키워드 검색 오류:', error);
      return [];
    }
  }

  getAllContent() {
    try {
      const query = `
        SELECT c.*, cd.*
        FROM content c
        LEFT JOIN content_detail cd ON c.crawl_id = cd.crawl_id
        ORDER BY c.collection_time DESC
      `;
      
      const result = this.db.exec(query);
      
      if (result.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values;
        
        return values.map(row => {
          const item = {};
          columns.forEach((col, idx) => {
            item[col] = row[idx];
          });
          return item;
        });
      }
      
      return [];
    } catch (error) {
      console.error('모든 콘텐츠 조회 오류:', error);
      return [];
    }
  }

  close() {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }
}

export default DatabaseService;
