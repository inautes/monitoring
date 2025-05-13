import express from 'express';
import AuthController from '../controllers/authController.js';

const router = express.Router();
const authController = new AuthController();

const initializeBrowser = async (req, res, next) => {
  try {
    if (!authController.browserService) {
      const browserConfig = {
        headless: process.env.HEADLESS !== 'false',
        timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10)
      };
      
      await authController.initialize(browserConfig);
    }
    next();
  } catch (error) {
    console.error('브라우저 초기화 오류:', error);
    res.status(500).json({
      success: false,
      message: '브라우저 초기화 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

router.post('/login/:siteId', initializeBrowser, authController.login.bind(authController));
router.post('/logout', initializeBrowser, authController.logout.bind(authController));

process.on('SIGINT', async () => {
  console.log('애플리케이션 종료 중...');
  await authController.close();
  process.exit(0);
});

export default router;
