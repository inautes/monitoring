import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BrowserService {
  constructor(config = {}) {
    this.browser = null;
    this.page = null;
    this.initialized = false;
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 30000,
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 2000,
      debug: config.debug || false,
      chromePath: config.chromePath || null
    };
  }

  async initialize() {
    if (this.initialized) {
      console.log('브라우저가 이미 초기화되었습니다.');
      return this;
    }

    let retryCount = 0;
    const maxRetries = this.config.retryCount;

    while (retryCount < maxRetries) {
      try {
        console.log(`시도 ${retryCount + 1}/${maxRetries} 시작...`);
        console.log('브라우저 초기화 시도...');

        const os = process.platform;
        console.log(`운영체제 감지: ${os}`);

        let executablePath = this.config.chromePath;
        
        if (!executablePath) {
          console.log('Chrome 경로를 감지하지 못했습니다. 내장 Chromium을 사용합니다.');
        }

        const launchOptions = {
          headless: this.config.headless ? 'new' : false,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080'
          ],
          defaultViewport: {
            width: 1920,
            height: 1080
          },
          timeout: this.config.timeout,
          protocolTimeout: this.config.timeout
        };

        if (executablePath) {
          launchOptions.executablePath = executablePath;
        }

        this.browser = await puppeteer.launch(launchOptions);
        this.page = await this.browser.newPage();
        
        this.page.setDefaultNavigationTimeout(this.config.timeout);
        this.page.setDefaultTimeout(this.config.timeout);

        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        if (this.config.debug) {
          this.page.on('console', msg => console.log('브라우저 콘솔:', msg.text()));
        }

        this.initialized = true;
        console.log('브라우저 초기화 성공');
        return this;
      } catch (error) {
        console.error(`브라우저 초기화 오류 (시도 ${retryCount + 1}/${maxRetries}):`, error.message);
        
        if (this.browser) {
          try {
            await this.browser.close();
          } catch (closeError) {
            console.error('브라우저 종료 오류:', closeError.message);
          }
          this.browser = null;
          this.page = null;
        }
        
        retryCount++;
        
        if (retryCount < maxRetries) {
          const delay = this.config.retryDelay * retryCount;
          console.log(`${delay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error(`브라우저 초기화 실패 (${maxRetries}회 시도 후): ${error.message}`);
        }
      }
    }
  }

  async login(url, credentials) {
    if (!this.initialized) {
      throw new Error('브라우저가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
    }

    console.log(`${url}에 로그인 시도...`);
    console.log(`사용자 이름: ${credentials.username}`);
    console.log(`비밀번호: ${'*'.repeat(credentials.password.length)}`);

    let retryCount = 0;
    const maxRetries = this.config.retryCount;

    while (retryCount < maxRetries) {
      try {
        console.log(`시도 ${retryCount + 1}/${maxRetries} 시작...`);
        console.log('로그인 시도 중...');

        await this.page.goto(url, { waitUntil: 'networkidle2' });

        console.log('로그인 폼 필드 찾는 중...');
        
        const formSelector = 'form[name="mainLoginForm"]';
        await this.page.waitForSelector(formSelector, { timeout: this.config.timeout });
        console.log('mainLoginForm 폼 발견');

        const idSelector = 'input[name="m_id"]';
        await this.page.waitForSelector(idSelector, { timeout: this.config.timeout });
        console.log('아이디 필드(m_id) 발견');

        const pwSelector = 'input[name="m_pwd"]';
        await this.page.waitForSelector(pwSelector, { timeout: this.config.timeout });
        console.log('비밀번호 필드(m_pwd) 발견');

        console.log('아이디 및 비밀번호 필드 발견, 입력 시작');

        await this.page.type(idSelector, credentials.username, { delay: 100 });
        console.log(`아이디 입력 완료: ${credentials.username}`);

        console.log('비밀번호를 JavaScript로 직접 설정합니다.');
        await this.page.evaluate((selector, value) => {
          document.querySelector(selector).value = value;
        }, pwSelector, credentials.password);
        console.log(`비밀번호 입력 완료: ${'*'.repeat(credentials.password.length)}`);

        const idValue = await this.page.evaluate(selector => document.querySelector(selector).value, idSelector);
        const pwValue = await this.page.evaluate(selector => document.querySelector(selector).value, pwSelector);

        console.log('필드 입력값 확인:');
        console.log(`- 아이디 필드: ${idValue}`);
        console.log(`- 비밀번호 필드: ${pwValue ? '입력됨' : '미입력'}`);

        const loginButtonSelector = 'input[type="submit"], button[type="submit"], input.login_btn';
        await this.page.waitForSelector(loginButtonSelector, { timeout: this.config.timeout });
        console.log('로그인 버튼 발견, 클릭 시도');

        console.log('페이지 이동 대기 중...');
        
        try {
          await Promise.all([
            this.page.click(loginButtonSelector),
            this.page.waitForNavigation({ timeout: this.config.timeout, waitUntil: 'networkidle2' })
          ]);
        } catch (navError) {
          console.log(`네비게이션 타임아웃: ${navError.message}`);
          
        }

        try {
          const isLoggedIn = await this.page.evaluate(() => {
            const logoutLink = document.querySelector('a[href*="logout"]');
            const myPageLink = document.querySelector('a[href*="mypage"]');
            const userInfo = document.querySelector('.user-info, .user_info, .userInfo');
            
            return !!(logoutLink || myPageLink || userInfo);
          });

          if (isLoggedIn) {
            console.log('로그인 성공!');
            return true;
          } else {
            const errorMessage = await this.page.evaluate(() => {
              const errorElement = document.querySelector('.error, .alert, .message');
              return errorElement ? errorElement.textContent.trim() : null;
            });

            if (errorMessage) {
              console.log(`로그인 실패: ${errorMessage}`);
            } else {
              console.log('로그인 실패: 로그인 상태를 확인할 수 없습니다.');
            }

            throw new Error('로그인 실패');
          }
        } catch (checkError) {
          console.log(`대체 로그인 방식 오류: ${checkError.message}`);
          throw new Error(checkError.message);
        }
      } catch (error) {
        console.log(`로그인 실패: ${error.message}`);
        
        retryCount++;
        
        if (retryCount < maxRetries) {
          const delay = this.config.retryDelay * retryCount;
          console.log(`${delay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error(`로그인 실패 (${maxRetries}회 시도 후): ${error.message}`);
        }
      }
    }

    return false;
  }

  async takeScreenshot(filename) {
    if (!this.initialized) {
      throw new Error('브라우저가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
    }

    try {
      const screenshotDir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const screenshotFilename = filename || `screenshot_${timestamp}.png`;
      const screenshotPath = path.join(screenshotDir, screenshotFilename);

      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`스크린샷 저장: ${screenshotPath}`);

      return screenshotPath;
    } catch (error) {
      console.error('스크린샷 촬영 오류:', error.message);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.initialized = false;
        console.log('브라우저 종료됨');
      } catch (error) {
        console.error('브라우저 종료 오류:', error.message);
        throw error;
      }
    }
  }
}

export default BrowserService;
