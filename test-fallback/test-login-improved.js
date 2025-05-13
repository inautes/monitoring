import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import BrowserService from '../src/services/browser.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const screenshotDir = path.join(rootDir, 'screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

dotenv.config({ path: path.join(rootDir, '.env') });

async function testImprovedLogin() {
  console.log('=== 테스트 시작: 개선된 로그인 기능 ===');
  
  const browserConfig = {
    headless: true, // 헤드리스 모드로 실행 (서버 환경용)
    timeout: 30000,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-gpu', 
      '--disable-dev-shm-usage',
      '--window-size=1366,768'
    ]
  };
  
  const browserService = new BrowserService(browserConfig);
  
  try {
    console.log('브라우저 초기화 중...');
    await browserService.initialize();
    console.log('브라우저 초기화 성공');
    
    const loginUrl = 'https://fileis.com/';
    const credentials = {
      username: process.env.FILEIS_USERNAME,
      password: process.env.FILEIS_PASSWORD
    };
    
    if (!credentials.username || !credentials.password) {
      throw new Error('환경 변수에 FILEIS_USERNAME 또는 FILEIS_PASSWORD가 설정되지 않았습니다.');
    }
    
    console.log(`${loginUrl}에 로그인 시도...`);
    console.log(`사용자 이름: ${credentials.username}`);
    console.log(`비밀번호: ${'*'.repeat(credentials.password.length)}`);
    
    await browserService.page.screenshot({ 
      path: path.join(screenshotDir, 'before_login_improved.png'),
      fullPage: true 
    });
    
    const beforeFormHTML = await browserService.page.evaluate(() => {
      const loginForm = document.querySelector('form#mainLoginForm') || document.querySelector('form');
      return loginForm ? loginForm.outerHTML : 'No login form found';
    });
    
    fs.writeFileSync(path.join(screenshotDir, 'login_form_before_improved.html'), beforeFormHTML);
    console.log('로그인 폼 HTML 구조 저장: screenshots/login_form_before_improved.html');
    
    const loginSuccess = await browserService.login(loginUrl, credentials);
    
    await browserService.page.screenshot({ 
      path: path.join(screenshotDir, 'after_login_improved.png'),
      fullPage: true 
    });
    
    const afterLoginHTML = await browserService.page.evaluate(() => {
      return document.body.innerHTML;
    });
    
    fs.writeFileSync(path.join(screenshotDir, 'page_after_login_improved.html'), afterLoginHTML);
    console.log('로그인 후 페이지 HTML 구조 저장: screenshots/page_after_login_improved.html');
    
    if (loginSuccess) {
      console.log('로그인 성공!');
      
      const currentUrl = await browserService.page.url();
      console.log(`현재 페이지 URL: ${currentUrl}`);
      
      const pageTitle = await browserService.page.title();
      console.log(`페이지 제목: ${pageTitle}`);
      
      const loginStatus = await browserService.page.evaluate(() => {
        const userInfoWrap = document.querySelector('.login-user-info-wrap');
        if (userInfoWrap) {
          const pointElement = userInfoWrap.querySelector('li.point');
          const bonusElement = userInfoWrap.querySelector('li.bonus');
          
          return {
            found: true,
            type: 'user-info-wrap',
            point: pointElement ? pointElement.textContent.trim() : 'Not found',
            bonus: bonusElement ? bonusElement.textContent.trim() : 'Not found'
          };
        }
        
        const logoutLink = document.querySelector('a[href*="logout"]');
        if (logoutLink) {
          return {
            found: true,
            type: 'logout-link',
            text: logoutLink.textContent.trim()
          };
        }
        
        return {
          found: false,
          bodyText: document.body.innerText.includes('로그아웃') || 
                   document.body.innerText.includes('마이페이지') || 
                   document.body.innerText.includes('회원정보')
        };
      });
      
      console.log('로그인 상태 확인:', JSON.stringify(loginStatus, null, 2));
      
      console.log('영화 카테고리로 이동 시도...');
      const categorySuccess = await browserService.navigateToCategory('CG001');
      
      if (categorySuccess) {
        console.log('카테고리 이동 성공!');
        
        await browserService.page.screenshot({ 
          path: path.join(screenshotDir, 'category_page_improved.png'),
          fullPage: true 
        });
        
        const categoryHTML = await browserService.page.evaluate(() => {
          return document.body.innerHTML;
        });
        
        fs.writeFileSync(path.join(screenshotDir, 'category_page_improved.html'), categoryHTML);
        console.log('카테고리 페이지 HTML 구조 저장: screenshots/category_page_improved.html');
        
        console.log('컨텐츠 목록 가져오기 시도...');
        const contentList = await browserService.getContentList();
        console.log(`컨텐츠 목록 ${contentList.length}개 항목 발견`);
        
        if (contentList.length > 0) {
          fs.writeFileSync(
            path.join(screenshotDir, 'content_list_improved.json'), 
            JSON.stringify(contentList, null, 2)
          );
          console.log('컨텐츠 목록 저장: screenshots/content_list_improved.json');
          
          console.log('첫 번째 컨텐츠 항목 상세 보기 시도...');
          
          await browserService.page.screenshot({ 
            path: path.join(screenshotDir, 'before_detail_improved.png'),
            fullPage: true 
          });
          
          const contentDetail = await browserService.getContentDetail(contentList[0]);
          
          await browserService.page.screenshot({ 
            path: path.join(screenshotDir, 'after_detail_improved.png'),
            fullPage: true 
          });
          
          if (contentDetail) {
            console.log('컨텐츠 상세 정보 가져오기 성공!');
            console.log('제목:', contentDetail.title);
            console.log('파일 크기:', contentDetail.fileSize);
            console.log('업로더:', contentDetail.uploaderId);
            
            fs.writeFileSync(
              path.join(screenshotDir, 'content_detail_improved.json'), 
              JSON.stringify(contentDetail, null, 2)
            );
            console.log('컨텐츠 상세 정보 저장: screenshots/content_detail_improved.json');
          } else {
            console.error('컨텐츠 상세 정보 가져오기 실패!');
          }
        } else {
          console.warn('컨텐츠 목록이 비어 있습니다.');
        }
      } else {
        console.error('카테고리 이동 실패!');
      }
      
      return true;
    } else {
      console.error('로그인 실패!');
      
      await browserService.page.screenshot({ 
        path: path.join(screenshotDir, 'login_failure_improved.png'),
        fullPage: true 
      });
      
      const formHTML = await browserService.page.evaluate(() => {
        const loginForm = document.querySelector('form#mainLoginForm') || document.querySelector('form');
        return loginForm ? loginForm.outerHTML : 'No login form found';
      });
      
      fs.writeFileSync(path.join(screenshotDir, 'login_form_failure_improved.html'), formHTML);
      console.log('로그인 폼 HTML 구조 저장: screenshots/login_form_failure_improved.html');
      
      const loginFormState = await browserService.page.evaluate(() => {
        const idField = document.querySelector('input[name="m_id"]');
        const pwField = document.querySelector('input[name="m_pwd"]');
        const errorMsg = document.querySelector('.error-message, .alert, .warning');
        
        return {
          idField: idField ? {
            exists: true,
            value: idField.value,
            visible: idField.offsetWidth > 0 && idField.offsetHeight > 0
          } : { exists: false },
          pwField: pwField ? {
            exists: true,
            value: pwField.value ? '(비밀번호 입력됨)' : '(비밀번호 입력되지 않음)',
            visible: pwField.offsetWidth > 0 && pwField.offsetHeight > 0
          } : { exists: false },
          errorMsg: errorMsg ? errorMsg.textContent.trim() : null
        };
      });
      
      console.log('로그인 폼 상태:', JSON.stringify(loginFormState, null, 2));
      
      return false;
    }
  } catch (error) {
    console.error('테스트 오류:', error.message);
    
    if (browserService && browserService.page) {
      await browserService.page.screenshot({ 
        path: path.join(screenshotDir, 'login_error_improved.png'),
        fullPage: true 
      });
    }
    
    throw error;
  } finally {
    console.log('브라우저 종료 중...');
    if (browserService) {
      await browserService.close();
    }
    console.log('브라우저 종료됨');
  }
}

testImprovedLogin()
  .then(success => {
    if (success) {
      console.log('=== 테스트 성공! ===');
      process.exit(0);
    } else {
      console.error('=== 테스트 실패! ===');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('=== 테스트 실패:', error.message, '===');
    process.exit(1);
  });
