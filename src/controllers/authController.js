import BrowserService from '../services/browser.js';
import { OSP } from '../models/index.js';

class AuthController {
  constructor() {
    this.browserService = null;
  }

  async initialize(browserConfig) {
    this.browserService = new BrowserService(browserConfig);
    await this.browserService.initialize();
    return this;
  }

  async login(req, res) {
    try {
      const { siteId } = req.params;
      
      const site = await OSP.findByPk(siteId);
      
      if (!site) {
        return res.status(404).json({
          success: false,
          message: '사이트 정보를 찾을 수 없습니다.'
        });
      }
      
      const loginSuccess = await this.browserService.login(
        site.loginUrl || 'https://fileis.com/',
        {
          username: site.login_id,
          password: site.login_pw
        }
      );
      
      if (loginSuccess) {
        return res.status(200).json({
          success: true,
          message: '로그인 성공',
          site: {
            id: site.site_id,
            name: site.site_name
          }
        });
      } else {
        return res.status(401).json({
          success: false,
          message: '로그인 실패'
        });
      }
    } catch (error) {
      console.error('로그인 처리 중 오류:', error);
      return res.status(500).json({
        success: false,
        message: '로그인 처리 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      if (this.browserService) {
        await this.browserService.page.evaluate(() => {
          const logoutBtn = document.querySelector('a[href*="logout"]');
          if (logoutBtn) {
            logoutBtn.click();
          }
        });
        
        return res.status(200).json({
          success: true,
          message: '로그아웃 성공'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: '브라우저 서비스가 초기화되지 않았습니다.'
        });
      }
    } catch (error) {
      console.error('로그아웃 처리 중 오류:', error);
      return res.status(500).json({
        success: false,
        message: '로그아웃 처리 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  async close() {
    if (this.browserService) {
      await this.browserService.close();
    }
  }
}

export default AuthController;
