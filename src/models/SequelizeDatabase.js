import md5 from 'md5';
import { sequelize, OSP, Content, ContentDetail, FileList, syncDatabase } from './index.js';

class SequelizeDatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.initialized = false;
  }

  async initialize() {
    try {
      await sequelize.authenticate();
      console.log('데이터베이스 연결 성공');
      
      await syncDatabase();
      this.initialized = true;
      
      return this;
    } catch (error) {
      console.error('데이터베이스 초기화 오류:', error);
      throw error;
    }
  }

  generateCrawlId(siteId, contentId, regDate) {
    const data = `${siteId}${contentId}${regDate}`;
    return md5(data);
  }

  async saveOSPInfo(ospInfo) {
    try {
      const safeOspInfo = {
        site_id: ospInfo?.siteId || '',
        site_name: ospInfo?.siteName || '',
        site_type: ospInfo?.siteType || '',
        site_equ: ospInfo?.siteEqu !== undefined ? ospInfo.siteEqu : 0,
        login_id: ospInfo?.loginId || '',
        login_pw: ospInfo?.loginPw || ''
      };
      
      console.log('OSP 정보 저장 (안전한 값 적용):', {
        site_id: safeOspInfo.site_id,
        site_name: safeOspInfo.site_name,
        site_type: safeOspInfo.site_type,
        site_equ: safeOspInfo.site_equ,
        login_id: safeOspInfo.login_id ? '설정됨' : '미설정',
        login_pw: safeOspInfo.login_pw ? '설정됨' : '미설정'
      });
      
      await OSP.upsert(safeOspInfo);
      
      return true;
    } catch (error) {
      console.error('OSP 정보 저장 오류:', error);
      return false;
    }
  }

  async saveContentInfo(contentInfo) {
    try {
      const safeContentInfo = {
        crawl_id: contentInfo?.crawlId || '',
        site_id: contentInfo?.siteId || '',
        content_id: contentInfo?.contentId || '',
        title: contentInfo?.title || '',
        genre: contentInfo?.genre || '',
        file_count: contentInfo?.fileCount !== undefined ? contentInfo.fileCount : 0,
        file_size: contentInfo?.fileSize || '',
        uploader_id: contentInfo?.uploaderId || '',
        collection_time: contentInfo?.collectionTime || new Date().toISOString(),
        detail_url: contentInfo?.detailUrl || ''
      };
      
      await Content.upsert(safeContentInfo);
      
      return true;
    } catch (error) {
      console.error('콘텐츠 정보 저장 오류:', error);
      return false;
    }
  }

  async saveContentDetailInfo(detailInfo) {
    try {
      const safeDetailInfo = {
        crawl_id: detailInfo?.crawlId || '',
        collection_time: detailInfo?.collectionTime || new Date().toISOString(),
        price: detailInfo?.price || '',
        price_unit: detailInfo?.priceUnit || '',
        partnership_status: detailInfo?.partnershipStatus || '',
        capture_filename: detailInfo?.captureFilename || '',
        status: detailInfo?.status || ''
      };
      
      await ContentDetail.upsert(safeDetailInfo);
      
      return true;
    } catch (error) {
      console.error('콘텐츠 상세 정보 저장 오류:', error);
      return false;
    }
  }

  async saveFileList(crawlId, fileList) {
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
      
      const transaction = await sequelize.transaction();
      
      try {
        for (const item of safeFileList) {
          const safeItem = {
            crawl_id: safeCrawlId,
            filename: item?.filename || '',
            file_size: item?.fileSize || ''
          };
          
          if (!safeItem.filename) {
            console.warn('파일 목록 저장 경고: 파일 이름이 비어 있는 항목 건너뜀');
            continue;
          }
          
          await FileList.create(safeItem, { transaction });
        }
        
        await transaction.commit();
        return true;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('파일 목록 저장 오류:', error);
      return false;
    }
  }

  async getContentByCrawlId(crawlId) {
    try {
      const content = await Content.findByPk(crawlId, {
        include: [ContentDetail]
      });
      
      return content ? content.toJSON() : null;
    } catch (error) {
      console.error('콘텐츠 조회 오류:', error);
      return null;
    }
  }

  async getFileListByCrawlId(crawlId) {
    try {
      const fileList = await FileList.findAll({
        where: { crawl_id: crawlId }
      });
      
      return fileList.map(file => file.toJSON());
    } catch (error) {
      console.error('파일 목록 조회 오류:', error);
      return [];
    }
  }

  async getContentByKeyword(keyword) {
    try {
      const { Op } = require('sequelize');
      
      const contents = await Content.findAll({
        include: [ContentDetail],
        where: {
          title: {
            [Op.like]: `%${keyword}%`
          }
        },
        order: [['collection_time', 'DESC']]
      });
      
      return contents.map(content => content.toJSON());
    } catch (error) {
      console.error('키워드 검색 오류:', error);
      return [];
    }
  }

  async getAllContent() {
    try {
      const contents = await Content.findAll({
        include: [ContentDetail],
        order: [['collection_time', 'DESC']]
      });
      
      return contents.map(content => content.toJSON());
    } catch (error) {
      console.error('모든 콘텐츠 조회 오류:', error);
      return [];
    }
  }

  async close() {
    try {
      await sequelize.close();
      console.log('데이터베이스 연결 종료');
    } catch (error) {
      console.error('데이터베이스 연결 종료 오류:', error);
    }
  }
}

export default SequelizeDatabaseService;
