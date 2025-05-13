import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retry(fn, retries = 3, delay = 1000, backoff = 2) {
  let lastError = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`시도 ${attempt + 1}/${retries} 시작...`);
      return await fn();
    } catch (error) {
      console.log(`시도 ${attempt + 1}/${retries} 실패: ${error.message}`);
      lastError = error;
      
      if (attempt < retries - 1) {
        const waitTime = delay * Math.pow(backoff, attempt);
        console.log(`${waitTime}ms 후 재시도...`);
        await sleep(waitTime);
      }
    }
  }
  
  throw lastError;
}

async function testCustomChromePath() {
  console.log('\n=== 테스트: 커스텀 Chrome 경로 사용 ===');
  
  const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  console.log(`Chrome 경로: ${chromePath}`);
  
  puppeteerExtra.use(StealthPlugin());
  
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ],
    defaultViewport: { width: 1366, height: 768 }
  };
  
  if (chromePath) {
    console.log(`사용자 지정 Chrome 경로 사용: ${chromePath}`);
    launchOptions.executablePath = chromePath;
  }
  
  return await retry(async () => {
    const browser = await puppeteerExtra.launch(launchOptions);
    
    try {
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(60000);
      
      console.log('fileis.com으로 이동 시도...');
      const response = await page.goto('https://fileis.com/', { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      console.log('응답 상태:', response.status());
      console.log('페이지 제목:', await page.title());
      
      return true;
    } catch (error) {
      console.error('테스트 오류:', error.message);
      throw error;
    } finally {
      await browser.close();
    }
  }, 3, 2000, 2);
}

async function testDefaultPuppeteer() {
  console.log('\n=== 테스트: 기본 Puppeteer 설정 ===');
  
  return await retry(async () => {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    try {
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(60000);
      
      console.log('fileis.com으로 이동 시도...');
      const response = await page.goto('https://fileis.com/', { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      console.log('응답 상태:', response.status());
      console.log('페이지 제목:', await page.title());
      
      return true;
    } catch (error) {
      console.error('테스트 오류:', error.message);
      throw error;
    } finally {
      await browser.close();
    }
  }, 3, 2000, 2);
}

async function runAllTests() {
  console.log('=== Chrome 경로 테스트 시작 ===');
  
  try {
    await testCustomChromePath();
    console.log('커스텀 Chrome 경로 테스트 성공!');
  } catch (error) {
    console.error('커스텀 Chrome 경로 테스트 실패:', error.message);
  }
  
  try {
    await testDefaultPuppeteer();
    console.log('기본 Puppeteer 테스트 성공!');
  } catch (error) {
    console.error('기본 Puppeteer 테스트 실패:', error.message);
  }
  
  console.log('=== 테스트 완료 ===');
}

runAllTests().catch(console.error);
