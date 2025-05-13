import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DemoController {
  constructor() {
    this.mockData = {
      categories: [
        { id: 'CG001', name: '영화', count: 120 },
        { id: 'CG002', name: '드라마', count: 85 },
        { id: 'CG003', name: '동영상 및 방송', count: 64 },
        { id: 'CG005', name: '애니', count: 42 }
      ],
      contentList: [
        {
          id: 'content001',
          title: '최신 영화 모음 폭싹속았수다',
          category: 'CG001',
          uploaderId: 'uploader123',
          fileSize: '2.4GB',
          uploadDate: '2025-04-15',
          detailUrl: '/detail/content001',
          containsKeyword: true
        },
        {
          id: 'content002',
          title: '인기 드라마 시리즈',
          category: 'CG002',
          uploaderId: 'uploader456',
          fileSize: '1.8GB',
          uploadDate: '2025-04-14',
          detailUrl: '/detail/content002',
          containsKeyword: false
        },
        {
          id: 'content003',
          title: '최신 예능 모음',
          category: 'CG003',
          uploaderId: 'uploader789',
          fileSize: '3.2GB',
          uploadDate: '2025-04-13',
          detailUrl: '/detail/content003',
          containsKeyword: false
        },
        {
          id: 'content004',
          title: '애니메이션 폭싹속았수다 특집',
          category: 'CG005',
          uploaderId: 'uploader101',
          fileSize: '1.5GB',
          uploadDate: '2025-04-12',
          detailUrl: '/detail/content004',
          containsKeyword: true
        }
      ],
      contentDetail: {
        id: 'content001',
        title: '최신 영화 모음 폭싹속았수다',
        category: 'CG001',
        uploaderId: 'uploader123',
        fileSize: '2.4GB',
        uploadDate: '2025-04-15',
        price: '1,000',
        priceUnit: '포인트',
        partnershipStatus: 'N',
        fileList: [
          { name: 'movie1.mp4', size: '1.2GB' },
          { name: 'movie2.mp4', size: '1.1GB' },
          { name: 'subtitle.srt', size: '10KB' }
        ],
        crawlId: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        captureFilename: '/images/IMGC01/2025/04/15/evidence_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.png',
        status: 'KEYWORD_FOUND'
      },
      searchResults: [
        {
          id: 'content001',
          title: '최신 영화 모음 폭싹속았수다',
          category: 'CG001',
          uploaderId: 'uploader123',
          fileSize: '2.4GB',
          uploadDate: '2025-04-15',
          detailUrl: '/detail/content001',
          containsKeyword: true
        },
        {
          id: 'content004',
          title: '애니메이션 폭싹속았수다 특집',
          category: 'CG005',
          uploaderId: 'uploader101',
          fileSize: '1.5GB',
          uploadDate: '2025-04-12',
          detailUrl: '/detail/content004',
          containsKeyword: true
        }
      ],
      stats: {
        totalMonitored: 311,
        keywordFound: 24,
        categories: {
          'CG001': 120,
          'CG002': 85,
          'CG003': 64,
          'CG005': 42
        },
        recentActivity: [
          {
            timestamp: '2025-04-16 06:15:23',
            action: '카테고리 CG001 스캔 완료',
            results: '120개 컨텐츠 발견, 8개 키워드 매칭'
          },
          {
            timestamp: '2025-04-16 06:10:12',
            action: '카테고리 CG002 스캔 완료',
            results: '85개 컨텐츠 발견, 5개 키워드 매칭'
          },
          {
            timestamp: '2025-04-16 06:05:45',
            action: '카테고리 CG003 스캔 완료',
            results: '64개 컨텐츠 발견, 3개 키워드 매칭'
          },
          {
            timestamp: '2025-04-16 06:01:18',
            action: '카테고리 CG005 스캔 완료',
            results: '42개 컨텐츠 발견, 8개 키워드 매칭'
          }
        ]
      }
    };
    
    this.getIndex = this.getIndex.bind(this);
    this.getCategory = this.getCategory.bind(this);
    this.getContentDetail = this.getContentDetail.bind(this);
    this.getSearch = this.getSearch.bind(this);
    this.getMonitoringStatus = this.getMonitoringStatus.bind(this);
  }

  getIndex(req, res) {
    res.render('index', {
      title: 'Laon Monitoring System',
      categories: this.mockData.categories
    });
  }

  getCategory(req, res) {
    const categoryId = req.params.id;
    const category = this.mockData.categories.find(cat => cat.id === categoryId);
    
    if (!category) {
      return res.status(404).render('error', {
        message: '카테고리를 찾을 수 없습니다.'
      });
    }
    
    res.render('category', {
      title: `${category.name} - Laon Monitoring`,
      category,
      contentList: this.mockData.contentList.filter(content => content.category === categoryId)
    });
  }

  getContentDetail(req, res) {
    const contentId = req.params.id;
    const content = this.mockData.contentDetail;
    
    if (contentId !== content.id) {
      return res.status(404).render('error', {
        message: '컨텐츠를 찾을 수 없습니다.'
      });
    }
    
    res.render('detail', {
      title: `${content.title} - Laon Monitoring`,
      content
    });
  }

  getSearch(req, res) {
    const keyword = req.query.keyword || '';
    
    if (!keyword) {
      return res.render('search', {
        title: '검색 - Laon Monitoring',
        keyword: '',
        results: []
      });
    }
    
    const results = keyword === '폭싹속았수다' 
      ? this.mockData.searchResults
      : [];
    
    res.render('search', {
      title: `검색: ${keyword} - Laon Monitoring`,
      keyword,
      results
    });
  }

  getMonitoringStatus(req, res) {
    res.render('status', {
      title: '모니터링 상태 - Laon Monitoring',
      stats: this.mockData.stats
    });
  }
}

export default new DemoController();
