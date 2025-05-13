import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

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

async function testBasicPuppeteer() {
  console.log('\n=== 테스트 1: 기본 Puppeteer ===');
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
    console.error('기본 Puppeteer 오류:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

async function testStealthPuppeteer() {
  console.log('\n=== 테스트 2: StealthPlugin 사용 ===');
  puppeteerExtra.use(StealthPlugin());
  
  const browser = await puppeteerExtra.launch({
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
    console.error('StealthPlugin Puppeteer 오류:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

async function testRetryPuppeteer() {
  console.log('\n=== 테스트 3: 재시도 메커니즘 사용 ===');
  puppeteerExtra.use(StealthPlugin());
  
  return await retry(async () => {
    const browser = await puppeteerExtra.launch({
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
      console.error('재시도 메커니즘 오류:', error.message);
      await browser.close();
      throw error;
    } finally {
      await browser.close();
    }
  }, 3, 2000, 2);
}

async function runAllTests() {
  console.log('=== fileis.com 연결 테스트 시작 ===');
  
  try {
    await testBasicPuppeteer();
    console.log('테스트 1 성공: 기본 Puppeteer');
  } catch (error) {
    console.log('테스트 1 실패: 기본 Puppeteer');
  }
  
  try {
    await testStealthPuppeteer();
    console.log('테스트 2 성공: StealthPlugin 사용');
  } catch (error) {
    console.log('테스트 2 실패: StealthPlugin 사용');
  }
  
  try {
    await testRetryPuppeteer();
    console.log('테스트 3 성공: 재시도 메커니즘 사용');
  } catch (error) {
    console.log('테스트 3 실패: 재시도 메커니즘 사용');
  }
  
  console.log('=== 테스트 완료 ===');
}

runAllTests().catch(console.error);
