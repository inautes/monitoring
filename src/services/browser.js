import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import os from 'os';
import fs from 'fs';
import path from 'path';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function detectChromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const platform = os.platform();
  console.log(`운영체제 감지: ${platform}`);

  if (platform === 'darwin') {
    const macOSChromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Users/' + os.userInfo().username + '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];

    for (const chromePath of macOSChromePaths) {
      try {
        if (fs.existsSync(chromePath)) {
          console.log(`macOS Chrome 경로 감지: ${chromePath}`);
          return chromePath;
        }
      } catch (error) {
        console.log(`경로 확인 오류: ${error.message}`);
      }
    }
  }

  if (platform === 'win32') {
    const windowsChromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];

    for (const chromePath of windowsChromePaths) {
      try {
        if (fs.existsSync(chromePath)) {
          console.log(`Windows Chrome 경로 감지: ${chromePath}`);
          return chromePath;
        }
      } catch (error) {
        console.log(`경로 확인 오류: ${error.message}`);
      }
    }
  }

  if (platform === 'linux') {
    const linuxChromePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ];

    for (const chromePath of linuxChromePaths) {
      try {
        if (fs.existsSync(chromePath)) {
          console.log(`Linux Chrome 경로 감지: ${chromePath}`);
          return chromePath;
        }
      } catch (error) {
        console.log(`경로 확인 오류: ${error.message}`);
      }
    }
  }

  console.log('Chrome 경로를 감지하지 못했습니다. 내장 Chromium을 사용합니다.');
  return null;
}

async function retry(fn, retries = 3, delay = 1000, backoff = 2) {
  const maxRetries = process.env.BROWSER_RETRY_COUNT ? parseInt(process.env.BROWSER_RETRY_COUNT, 10) : retries;
  const initialDelay = process.env.BROWSER_RETRY_DELAY ? parseInt(process.env.BROWSER_RETRY_DELAY, 10) : delay;

  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`시도 ${attempt + 1}/${maxRetries} 시작...`);
      return await fn();
    } catch (error) {
      console.log(`시도 ${attempt + 1}/${maxRetries} 실패: ${error.message}`);
      lastError = error;

      if (attempt < maxRetries - 1) {
        const waitTime = initialDelay * Math.pow(backoff, attempt);
        console.log(`${waitTime}ms 후 재시도...`);
        await sleep(waitTime);
      }
    }
  }

  throw lastError;
}

class BrowserService {
  constructor(config) {
    this.config = config || {
      headless: true,
      timeout: 30000
    };
    this.browser = null;
    this.page = null;

    puppeteerExtra.use(StealthPlugin());
  }

  async initialize() {
    return await retry(async () => {
      try {
        console.log('브라우저 초기화 시도...');

        const launchOptions = {
          headless: this.config.headless === true ? 'new' : false,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ],
          defaultViewport: { width: 1366, height: 768 },
          dumpio: process.env.BROWSER_DEBUG === 'true' // 브라우저 내부 로그 출력 활성화 (디버깅용)
        };

        const chromePath = detectChromePath();
        if (chromePath) {
          console.log(`Chrome 경로 사용: ${chromePath}`);
          launchOptions.executablePath = chromePath;
        }

        this.browser = await puppeteerExtra.launch(launchOptions);

        if (!this.browser) {
          throw new Error('브라우저 실행 실패: browser 인스턴스가 null입니다.');
        }

        this.page = await this.browser.newPage();
        await this.page.setDefaultNavigationTimeout(this.config.timeout);
        await this.page.setDefaultTimeout(this.config.timeout);

        console.log('브라우저 초기화 성공');
        return this;
      } catch (error) {
        console.error('브라우저 초기화 중 오류 발생:', error);

        if (this.browser) {
          try {
            await this.browser.close();
          } catch (closeError) {
            console.error('브라우저 종료 중 오류:', closeError.message);
          }
          this.browser = null;
        }

        throw error;
      }
    }, 3, 2000, 2);
  }

  async login(url, credentials) {
    return await retry(async () => {
      console.log('로그인 시도 중...');

      try {
        await this.page.goto(url, { waitUntil: 'networkidle2' });

        console.log('로그인 폼 필드 찾는 중...');

        try {
          await this.page.waitForSelector('form#mainLoginForm', { timeout: this.config.timeout / 2 });
          console.log('mainLoginForm 폼 발견');

          await this.page.waitForSelector('input[name="m_id"]', { timeout: this.config.timeout / 2 });
          console.log('아이디 필드(m_id) 발견');

          await this.page.waitForSelector('input[name="m_pwd"]', { timeout: this.config.timeout / 2 });
          console.log('비밀번호 필드(m_pwd) 발견');
        } catch (error) {
          console.warn('fileis.com 전용 셀렉터 실패, 일반 셀렉터로 시도:', error.message);

          try {
            await this.page.waitForSelector('input[type="text"][name*="id"], #login_id, #user_id, input[name="user_id"]', { timeout: this.config.timeout / 2 });
            await this.page.waitForSelector('input[type="password"], #login_pw, #user_pw, input[name="user_pw"]', { timeout: this.config.timeout / 2 });
          } catch (error) {
            console.warn('일반 로그인 폼 셀렉터 타임아웃:', error.message);

            const inputFields = await this.page.$$('input[type="text"], input[type="password"]');
            if (inputFields.length < 2) {
              throw new Error('로그인 폼 필드를 찾을 수 없습니다');
            }
          }
        }

        let idField = await this.page.$('input[name="m_id"]');
        let pwField = await this.page.$('input[name="m_pwd"]');

        if (!idField || !pwField) {
          console.log('fileis.com 전용 셀렉터 실패, 일반 셀렉터 사용');
          idField = await this.page.$('input[type="text"][name*="id"], #login_id, #user_id, input[name="user_id"]');
          pwField = await this.page.$('input[type="password"], #login_pw, #user_pw, input[name="user_pw"]');
        }

        if (idField && pwField) {
          console.log('아이디 및 비밀번호 필드 발견, 입력 시작');

          await this.page.evaluate(() => {
            const idField = document.querySelector('input[name="m_id"]') ||
                           document.querySelector('input[type="text"][name*="id"]') ||
                           document.querySelector('#login_id') ||
                           document.querySelector('#user_id') ||
                           document.querySelector('input[name="user_id"]');

            const pwField = document.querySelector('input[name="m_pwd"]') ||
                           document.querySelector('input[type="password"]') ||
                           document.querySelector('#login_pw') ||
                           document.querySelector('#user_pw') ||
                           document.querySelector('input[name="user_pw"]');

            if (idField) idField.value = '';
            if (pwField) pwField.value = '';
          });

          await idField.click({ clickCount: 3 }); // 전체 선택
          await idField.press('Backspace'); // 내용 삭제
          await idField.type(credentials.username);
          console.log(`아이디 입력 완료: ${credentials.username}`);

          try {
            await pwField.click({ clickCount: 3 }); // 전체 선택
            await pwField.press('Backspace'); // 내용 삭제
            
            console.log('비밀번호를 JavaScript로 직접 설정합니다.');
            await this.page.evaluate((password) => {
              const pwField = document.querySelector('input[name="m_pwd"]');
              if (pwField) {
                console.log('fileis.com 비밀번호 필드(m_pwd) 발견');
                pwField.value = password;
                return;
              }
              
              const altPwField = document.querySelector('input[type="password"]') ||
                                document.querySelector('#login_pw') ||
                                document.querySelector('#user_pw') ||
                                document.querySelector('input[name="user_pw"]');
              if (altPwField) {
                console.log('대체 비밀번호 필드 발견');
                altPwField.value = password;
              } else {
                console.error('비밀번호 필드를 찾을 수 없음');
              }
            }, credentials.password);
            
            console.log(`비밀번호 입력 완료: ${'*'.repeat(credentials.password.length)}`);
            
            const pwValue = await this.page.evaluate(() => {
              const pwField = document.querySelector('input[name="m_pwd"]') ||
                             document.querySelector('input[type="password"]') ||
                             document.querySelector('#login_pw') ||
                             document.querySelector('#user_pw') ||
                             document.querySelector('input[name="user_pw"]');
              return pwField ? pwField.value : '';
            });
            
            if (!pwValue) {
              console.warn('비밀번호가 입력되지 않았을 수 있습니다. 대체 방법 시도...');
              
              const retryJsResult = await this.page.evaluate((password) => {
                const inputs = document.querySelectorAll('input');
                for (const input of inputs) {
                  if (input.type === 'password' || input.name.includes('pwd') || input.name.includes('pass')) {
                    console.log(`비밀번호 필드 발견: ${input.name || input.id || 'unnamed'}`);
                    input.value = password;
                    return true;
                  }
                }
                return false;
              }, credentials.password);
              
              if (!retryJsResult) {
                console.log('문자별 입력 방식으로 비밀번호 입력 시도...');
                await pwField.click({ clickCount: 3 });
                await pwField.press('Backspace');
                for (const char of credentials.password) {
                  await pwField.press(char);
                  await this.page.waitForTimeout(50); // 각 문자 입력 사이에 약간의 지연
                }
                console.log('문자별 입력 방식으로 비밀번호 입력 완료');
              }
            }
          } catch (error) {
            console.error('비밀번호 입력 중 오류:', error.message);
            throw new Error('비밀번호 입력 실패');
          }

          const fieldValues = await this.page.evaluate(() => {
            const idField = document.querySelector('input[name="m_id"]') ||
                           document.querySelector('input[type="text"][name*="id"]') ||
                           document.querySelector('#login_id');

            const pwField = document.querySelector('input[name="m_pwd"]') ||
                           document.querySelector('input[type="password"]') ||
                           document.querySelector('#login_pw');

            return {
              idValue: idField ? idField.value : '알 수 없음',
              pwValue: pwField ? (pwField.value ? '입력됨' : '비어 있음') : '알 수 없음'
            };
          });

          console.log('필드 입력값 확인:');
          console.log(`- 아이디 필드: ${fieldValues.idValue}`);
          console.log(`- 비밀번호 필드: ${fieldValues.pwValue}`);

          const loginButton = await this.page.$('input[type="submit"], button[type="submit"], .login_btn, input[value="로그인"]');

          if (loginButton) {
            console.log('로그인 버튼 발견, 클릭 시도');
            await loginButton.click();
          } else {
            console.log('로그인 버튼을 찾지 못했습니다. 폼 제출을 시도합니다.');

            const formSubmitted = await this.page.evaluate(() => {
              const mainForm = document.querySelector('form[name="mainLoginForm"]');
              if (mainForm) {
                console.log('mainLoginForm 폼 제출');
                mainForm.submit();
                return true;
              }

              const form = document.querySelector('form');
              if (form) {
                console.log('일반 폼 제출');
                form.submit();
                return true;
              }

              return false;
            });

            if (!formSubmitted) {
              throw new Error('로그인 폼을 제출할 수 없습니다');
            }
          }

          try {
            console.log('페이지 이동 대기 중...');
            await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.config.timeout });
            console.log('페이지 이동 완료');

            console.log('로그인 후 팝업 확인 중...');
            try {
              console.log('팝업이 나타날 때까지 대기 중...');
              await this.page.waitForTimeout(2000);
              
              const popupSelectors = [
                '.popup_close', '.close_btn', '.btn_close', '.layer_close', '.modal_close',
                '.close', '.btn-close', '.popup-close', '.layer-close', '.modal-close',
                '.closeBtn', '.close-btn', '.popup-btn-close', '.layer-btn-close',
                '[class*="close"]', '[class*="Close"]', '[id*="close"]', '[id*="Close"]',
                
                'button.confirm', 'input[type="button"][value="확인"]', '.btn_confirm',
                '.confirm-btn', '.btn-confirm', '.ok-btn', '.btn-ok',
                '[class*="confirm"]', '[class*="Confirm"]', '[id*="confirm"]', '[id*="Confirm"]',
                
                'button', 'input[type="button"]', 'a.btn', '.btn', '[role="button"]'
              ];

              const popupContainerSelectors = [
                '.popup', '.modal', '.layer', '.alert', '.dialog',
                '.popup_container', '.modal_container', '.layer_container',
                '.popup-container', '.modal-container', '.layer-container',
                '[class*="popup"]', '[class*="modal"]', '[class*="layer"]',
                '[class*="Popup"]', '[class*="Modal"]', '[class*="Layer"]',
                '[role="dialog"]', '[aria-modal="true"]'
              ];
              
              let popupContainers = [];
              for (const selector of popupContainerSelectors) {
                const containers = await this.page.$$(selector);
                if (containers.length > 0) {
                  console.log(`팝업 컨테이너 발견: ${selector}, ${containers.length}개`);
                  popupContainers = popupContainers.concat(containers);
                }
              }
              
              if (popupContainers.length > 0) {
                for (const container of popupContainers) {
                  const buttonTexts = await this.page.evaluate(container => {
                    const buttons = container.querySelectorAll('button, input[type="button"], a.btn, .btn');
                    return Array.from(buttons).map(btn => ({
                      text: btn.textContent?.trim() || btn.value || '',
                      isClose: (btn.textContent?.includes('닫기') || 
                               btn.textContent?.includes('확인') || 
                               btn.textContent?.includes('Close') || 
                               btn.textContent?.includes('OK') ||
                               btn.className.includes('close') ||
                               btn.className.includes('confirm'))
                    }));
                  }, container);
                  
                  console.log(`팝업 내 버튼 텍스트: ${JSON.stringify(buttonTexts)}`);
                  
                  const closeButtons = await this.page.evaluate(container => {
                    const buttons = container.querySelectorAll('button, input[type="button"], a.btn, .btn');
                    const closeButtons = Array.from(buttons).filter(btn => 
                      btn.textContent?.includes('닫기') || 
                      btn.textContent?.includes('확인') || 
                      btn.textContent?.includes('Close') || 
                      btn.textContent?.includes('OK') ||
                      btn.className.includes('close') ||
                      btn.className.includes('confirm')
                    );
                    
                    if (closeButtons.length > 0) {
                      closeButtons.forEach(btn => {
                        console.log(`팝업 버튼 클릭: ${btn.textContent || btn.className}`);
                        btn.click();
                      });
                      return true;
                    }
                    return false;
                  }, container);
                  
                  if (closeButtons) {
                    console.log('팝업 내 닫기/확인 버튼 클릭됨');
                    await this.page.waitForTimeout(500);
                  }
                }
              }
              
              for (const selector of popupSelectors) {
                const popupCloseButtons = await this.page.$$(selector);
                if (popupCloseButtons.length > 0) {
                  console.log(`팝업 버튼 발견: ${selector}, ${popupCloseButtons.length}개`);
                  
                  for (const button of popupCloseButtons) {
                    const buttonText = await this.page.evaluate(el => el.textContent?.trim() || el.value || '', button);
                    const buttonClass = await this.page.evaluate(el => el.className || '', button);
                    
                    const isCloseButton = buttonText.includes('닫기') || 
                                         buttonText.includes('확인') || 
                                         buttonText.includes('Close') || 
                                         buttonText.includes('OK') ||
                                         buttonClass.includes('close') ||
                                         buttonClass.includes('confirm');
                    
                    if (selector.includes('button') || selector.includes('input') || selector.includes('a.btn') || selector.includes('.btn')) {
                      if (!isCloseButton) {
                        console.log(`일반 버튼 무시: ${buttonText || buttonClass}`);
                        continue;
                      }
                    }
                    
                    console.log(`팝업 버튼 클릭: ${buttonText || buttonClass}`);
                    await button.click().catch(e => console.log(`팝업 버튼 클릭 실패: ${e.message}`));
                    await this.page.waitForTimeout(500); // 팝업 닫힘 대기
                  }
                }
              }
              
              await this.page.evaluate(() => {
                const closePopups = () => {
                  const popupContainers = document.querySelectorAll(
                    '.popup, .modal, .layer, .alert, .dialog, ' +
                    '.popup_container, .modal_container, .layer_container, ' +
                    '[class*="popup"], [class*="modal"], [class*="layer"], ' +
                    '[role="dialog"], [aria-modal="true"]'
                  );
                  
                  if (popupContainers.length > 0) {
                    console.log(`자바스크립트로 팝업 컨테이너 ${popupContainers.length}개 발견`);
                    
                    popupContainers.forEach(container => {
                      const closeButtons = container.querySelectorAll(
                        '.close, .close_btn, .btn_close, .popup_close, .layer_close, ' +
                        '.confirm, .btn_confirm, .confirm_btn, ' +
                        'button, input[type="button"], a.btn, .btn'
                      );
                      
                      if (closeButtons.length > 0) {
                        closeButtons.forEach(button => {
                          const buttonText = button.textContent?.trim() || button.value || '';
                          const buttonClass = button.className || '';
                          
                          if (buttonText.includes('닫기') || 
                              buttonText.includes('확인') || 
                              buttonText.includes('Close') || 
                              buttonText.includes('OK') ||
                              buttonClass.includes('close') ||
                              buttonClass.includes('confirm')) {
                            console.log(`자바스크립트로 팝업 버튼 클릭: ${buttonText || buttonClass}`);
                            button.click();
                          }
                        });
                      } else {
                        console.log('팝업 버튼을 찾을 수 없어 ESC 키 이벤트 발생');
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
                      }
                    });
                  }
                  
                  const popupButtons = document.querySelectorAll('button, input[type="button"], a.btn, .btn');
                  for (const button of popupButtons) {
                    const buttonText = button.textContent?.trim() || button.value || '';
                    const buttonClass = button.className || '';
                    
                    if (buttonText.includes('닫기') || 
                        buttonText.includes('확인') || 
                        buttonText.includes('Close') || 
                        buttonText.includes('OK') ||
                        buttonClass.includes('close') ||
                        buttonClass.includes('confirm')) {
                      console.log(`자바스크립트로 개별 버튼 클릭: ${buttonText || buttonClass}`);
                      button.click();
                    }
                  }
                };
                
                closePopups();
                setTimeout(closePopups, 1000);
                setTimeout(closePopups, 2000);
              });
              
              await this.page.keyboard.press('Escape');
              console.log('ESC 키로 추가 팝업 닫기 시도');
              
              await this.page.waitForTimeout(1000);
              console.log('팝업 처리 완료');
            } catch (popupError) {
              console.log('팝업 처리 중 오류 (무시됨):', popupError.message);
            }
          } catch (error) {
            console.warn('네비게이션 타임아웃:', error.message);
            console.log('타임아웃이 발생했지만 로그인은 성공했을 수 있습니다. 로그인 상태 확인 계속...');
          }
          
          let alternativeLoginAttempted = false;
          
          try {
            const currentUrl = await this.page.url();
            console.log('현재 URL:', currentUrl);
            
            const quickLoginCheck = await this.page.evaluate(() => {
              return {
                hasLogoutBtn: !!document.querySelector('.logout_btn'),
                hasUserInfo: !!document.querySelector('.user-info, .user_info'),
                hasLoginUserInfoWrap: !!document.querySelector('.login-user-info-wrap'),
                bodyText: document.body.innerText.includes('로그아웃') || 
                         document.body.innerText.includes('마이페이지') || 
                         document.body.innerText.includes('회원정보')
              };
            });
            
            console.log('빠른 로그인 상태 확인:', JSON.stringify(quickLoginCheck));
            
            if (!quickLoginCheck.hasLogoutBtn && 
                !quickLoginCheck.hasUserInfo && 
                !quickLoginCheck.hasLoginUserInfoWrap && 
                !quickLoginCheck.bodyText) {
              
              console.log('로그인이 되지 않은 것으로 보임, 대체 로그인 방식 시도');
              alternativeLoginAttempted = true;
              
              const response = await this.page.evaluate(async (username, password) => {
                try {
                  console.log('fetch API를 사용한 로그인 시도');
                  
                  const formData = new FormData();
                  formData.append('m_id', username);
                  formData.append('m_pwd', password);
                  formData.append('caller', 'main');
                  formData.append('location', 'main');
                  
                  const response = await fetch('/member/loginCheck.php', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin',
                    redirect: 'follow'
                  });
                  
                  if (!response.ok) {
                    console.error('로그인 요청 실패:', response.status, response.statusText);
                    return { success: false, status: response.status, message: response.statusText };
                  }
                  
                  const text = await response.text();
                  console.log('로그인 응답:', text.substring(0, 100) + '...');
                  
                  return { 
                    success: true, 
                    redirected: response.redirected,
                    url: response.url,
                    text: text.substring(0, 100)
                  };
                } catch (e) {
                  console.error('fetch 로그인 실패:', e.message);
                  return { success: false, error: e.message };
                }
              }, credentials.username, credentials.password);
              
              console.log('fetch 로그인 결과:', JSON.stringify(response));
              
              if (response && response.success) {
                console.log('대체 로그인 방식 성공');
                await this.page.waitForTimeout(2000); // 로그인 처리 대기
                
                await this.page.reload({ waitUntil: 'networkidle2' });
                console.log('페이지 새로고침 완료');
              } else {
                console.warn('대체 로그인 방식 실패:', response ? response.error || response.message : '알 수 없는 오류');
                
                try {
                  console.log('직접 URL 이동을 통한 로그인 시도');
                  await this.page.goto('https://fileis.com/member/loginCheck.php', { 
                    waitUntil: 'networkidle2',
                    timeout: this.config.timeout / 2
                  });
                  console.log('로그인 처리 페이지로 이동 완료');
                  
                  await this.page.goto('https://fileis.com/', { 
                    waitUntil: 'networkidle2',
                    timeout: this.config.timeout / 2
                  });
                  console.log('메인 페이지로 복귀 완료');
                } catch (directNavError) {
                  console.warn(`직접 URL 이동 실패: ${directNavError.message}`);
                }
              }
            }
          } catch (altLoginError) {
            console.warn(`대체 로그인 방식 오류: ${altLoginError.message}`);
          }
          
          const loggedIn = await this.page.evaluate(() => {
            if (document.querySelector('.logout_btn') || 
                document.querySelector('.user-info') || 
                document.querySelector('.user_info')) {
              console.log('로그아웃 버튼 또는 사용자 정보 요소 발견: 로그인 성공 확인됨');
              return true;
            }

            const loginUserInfoWrap = document.querySelector('.login-user-info-wrap');
            if (loginUserInfoWrap) {
              console.log('login-user-info-wrap 요소 발견: 로그인 성공 확인됨');
              
              const pointElement = loginUserInfoWrap.querySelector('li.point b');
              const bonusElement = loginUserInfoWrap.querySelector('li.bonus b');
              
              if (pointElement) {
                console.log(`포인트 요소 발견: ${pointElement.textContent.trim()}`);
              }
              
              if (bonusElement) {
                console.log(`보너스 요소 발견: ${bonusElement.textContent.trim()}`);
              }
              
              return true;
            }

            const pointElement = document.querySelector('li.point b');
            const bonusElement = document.querySelector('li.bonus b');

            if (pointElement || bonusElement) {
              if (pointElement) {
                console.log(`포인트 요소 발견: ${pointElement.textContent.trim()}`);
              }
              
              if (bonusElement) {
                console.log(`보너스 요소 발견: ${bonusElement.textContent.trim()}`);
              }
              
              return true;
            }

            const links = Array.from(document.querySelectorAll('a'));
            for (const link of links) {
              if (link.textContent && 
                  (link.textContent.includes('로그아웃') || 
                   link.textContent.includes('Logout') || 
                   link.textContent.includes('Log out'))) {
                console.log(`로그아웃 링크 발견: ${link.textContent.trim()}`);
                return true;
              }
            }

            const userElements = Array.from(document.querySelectorAll('.user, .username, .user-name, .account-info, .member-info'));
            if (userElements.length > 0) {
              userElements.forEach(element => {
                console.log(`사용자 요소 발견: ${element.textContent.trim()}`);
              });
              return true;
            }

            const mypageLinks = Array.from(document.querySelectorAll('a'));
            for (const link of mypageLinks) {
              if (link.textContent && 
                  (link.textContent.includes('마이페이지') || 
                   link.textContent.includes('My Page') || 
                   link.textContent.includes('내 정보'))) {
                console.log(`마이페이지 링크 발견: ${link.textContent.trim()}`);
                return true;
              }
            }

            console.log('로그인 상태 요소를 찾을 수 없음: 로그인 실패로 간주');
            return false;
          });

          if (loggedIn) {
            console.log('로그인 성공!');
            return true;
          } else {
            console.warn('로그인 실패: 로그인 상태를 확인할 수 없습니다');
            return false; // 중요 변경: 로그인 실패 시 false 반환
          }
        } else {
          throw new Error('로그인 폼 필드를 찾을 수 없습니다');
        }
      } catch (error) {
        console.error('로그인 실패:', error.message);
        throw error; // 재시도를 위해 오류를 다시 던짐
      }
    }, 3, 2000, 2); // 최대 3번 재시도, 2초 지연, 지수 백오프
  }

  async navigateToCategory(category) {
    try {
      console.log(`카테고리로 이동: ${category}`);

      const categoryUrls = {
        'CG001': 'https://fileis.com/contents/index.htm?category1=MVO', // 영화
        'CG002': 'https://fileis.com/contents/index.htm?category1=DRA', // 드라마
        'CG003': 'https://fileis.com/contents/index.htm?category1=VDO', // 동영상 및 방송
        'CG005': 'https://fileis.com/contents/index.htm?category1=ANI'  // 애니
      };

      const url = categoryUrls[category];
      if (!url) {
        throw new Error(`알 수 없는 카테고리: ${category}`);
      }

      return await retry(async () => {
        const response = await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });

        if (!response || !response.ok()) {
          throw new Error(`카테고리 페이지 로드 실패: ${response ? response.status() : 'No response'}`);
        }

        await this.page.waitForSelector('.list_table, table.board_list, .content-list, .file-list', { timeout: this.config.timeout });

        const currentUrl = this.page.url();
        if (!currentUrl.includes(url.split('?')[0])) {
          throw new Error(`카테고리 URL 불일치: ${currentUrl}`);
        }

        return true;
      });
    } catch (error) {
      console.error(`카테고리 이동 오류: ${error.message}`);
      return false;
    }
  }

  async getContentList(category, pageNum = 1) {
    try {
      console.log(`컨텐츠 목록 가져오기: 카테고리=${category}, 페이지=${pageNum}`);

      if (category) {
        const categorySuccess = await this.navigateToCategory(category);
        if (!categorySuccess) {
          console.error(`카테고리 이동 실패: ${category}`);
          return [];
        }
      }

      return await retry(async () => {
        if (pageNum > 1) {
          try {
            console.log(`페이지 ${pageNum}로 이동 시도`);
            const paginationSelector = '.pagination a, .paging a, a.page-link, a[href*="page="]';
            await this.page.waitForSelector(paginationSelector, { timeout: this.config.timeout });

            const pageLinks = await this.page.$$(paginationSelector);

            if (pageLinks.length > 0) {
              let pageFound = false;

              for (const link of pageLinks) {
                const linkText = await this.page.evaluate(el => el.textContent.trim(), link);
                if (linkText === String(pageNum)) {
                  await link.click();
                  await this.page.waitForNavigation({
                    waitUntil: 'networkidle2',
                    timeout: this.config.timeout
                  });
                  pageFound = true;
                  break;
                }
              }

              if (!pageFound) {
                console.warn(`페이지 ${pageNum}를 찾을 수 없음`);
              }
            } else {
              console.warn('페이지네이션 링크를 찾을 수 없음');
            }
          } catch (error) {
            console.warn(`페이지네이션 처리 오류: ${error.message}`);
            throw new Error(`페이지 ${pageNum}로 이동 실패: ${error.message}`);
          }
        }

        const tableSelector = '.list_table, table.board_list, .content-list, .file-list';
        await this.page.waitForSelector(tableSelector, { timeout: this.config.timeout });

        const contentList = await this.page.evaluate(() => {
          const tableSelectors = ['.list_table', 'table.board_list', '.content-list', '.file-list'];
          let table = null;

          for (const selector of tableSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              table = element;
              break;
            }
          }

          if (!table) return [];

          const rows = Array.from(table.querySelectorAll('tr:not(.list_head):not(.thead):not(th)'));

          return rows.map(row => {
            const titleElement = row.querySelector('.list_title a, td.title a, .subject a, a[href*="content_id"]');
            const sizeElement = row.querySelector('.list_size, td.size, .filesize, td:nth-child(3)');
            const uploaderElement = row.querySelector('.list_uploader, td.uploader, .username, td:nth-child(4)');

            if (!titleElement) return null;

            let contentId = '';
            const href = titleElement.getAttribute('href') || '';

            const contentIdPatterns = [
              /content_id=([^&]+)/,
              /id=([^&]+)/,
              /view\/([^\/]+)/,
              /([0-9]+)$/
            ];

            for (const pattern of contentIdPatterns) {
              const match = href.match(pattern);
              if (match && match[1]) {
                contentId = match[1];
                break;
              }
            }

            return {
              contentId: contentId,
              title: titleElement.textContent.trim(),
              detailUrl: titleElement.getAttribute('href') || '',
              fileSize: sizeElement ? sizeElement.textContent.trim() : '',
              uploaderId: uploaderElement ? uploaderElement.textContent.trim() : ''
            };
          }).filter(item => item !== null);
        });

        console.log(`컨텐츠 목록 ${contentList.length}개 항목 추출 완료`);
        return contentList;
      });
    } catch (error) {
      console.error(`컨텐츠 목록 가져오기 실패: ${error.message}`);
      return [];
    }
  }

  async getContentDetail(contentItem) {
    try {
      console.log(`컨텐츠 상세정보 가져오기: ${contentItem.title || contentItem.url || '제목 없음'}`);

      if (!contentItem) {
        console.error('컨텐츠 항목이 제공되지 않음');
        return null;
      }

      if (typeof contentItem === 'string') {
        return await this.getContentDetailByUrl(contentItem);
      }

      return await retry(async () => {
        if (contentItem.selector) {
          await this.page.click(contentItem.selector);
        } else if (contentItem.element) {
          await contentItem.element.click();
        } else if (contentItem.detailUrl) {
          return await this.getContentDetailByUrl(contentItem.detailUrl);
        } else {
          throw new Error('컨텐츠 항목에 클릭할 요소나 URL이 없음');
        }

        console.log('레이어 팝업이 나타날 때까지 대기 중...');
        await this.page.waitForTimeout(1000);
        
        const popupSelectors = [
          '.layer_popup', '.modal-content', '.popup-detail', '.detail-layer',
          '.content-view-popup', '.content_detail_popup', '[role="dialog"]',
          
          '.layer-popup', '.view_layer', '.content_view', '.detail_view',
          '.file_detail_layer', '#detailPopup', '.board_view_popup',
          '.layer_detail', '.modal_detail', '.popup_detail', '.detail_popup',
          '.view_popup', '.content_layer', '.file_view', '.file_layer',
          
          '[class*="layer"][class*="popup"]', '[class*="modal"][class*="content"]',
          '[class*="detail"][class*="view"]', '[class*="popup"][class*="content"]',
          '[class*="layer"][class*="detail"]', '[class*="modal"][class*="detail"]',
          '[aria-modal="true"]', '[role="dialog"]', '[role="alertdialog"]',
          
          '.detail-layer-content', '.file-detail-popup', '.view-detail-layer',
          '.content-detail-view', '.file-info-layer', '.file-detail-view'
        ];
        
        let popupSelector = null;
        let popupElement = null;
        
        for (const selector of popupSelectors) {
          try {
            const exists = await this.page.$(selector);
            if (exists) {
              popupSelector = selector;
              popupElement = exists;
              
              await this.page.waitForSelector(selector, { 
                visible: true, 
                timeout: this.config.timeout / 2 
              });
              
              console.log(`팝업 요소 발견: ${selector}`);
              
              try {
                const innerSelectors = [
                  `${selector} .title`, `${selector} .content`, 
                  `${selector} .file-info`, `${selector} .detail-info`,
                  `${selector} h3`, `${selector} .file-list`
                ];
                
                for (const innerSelector of innerSelectors) {
                  const innerElement = await this.page.$(innerSelector);
                  if (innerElement) {
                    await this.page.waitForSelector(innerSelector, { 
                      visible: true, 
                      timeout: 2000 
                    });
                    console.log(`팝업 내부 요소 발견: ${innerSelector}`);
                    break;
                  }
                }
              } catch (innerError) {
                console.log(`팝업 내부 요소 대기 중 오류: ${innerError.message}`);
              }
              
              break;
            }
          } catch (error) {
            console.log(`선택자 '${selector}' 확인 중 오류: ${error.message}`);
          }
        }
        
        if (!popupSelector) {
          console.warn('팝업 요소를 찾을 수 없습니다. 대체 방법으로 팝업 감지를 시도합니다.');
          
          try {
            const beforeElements = await this.page.evaluate(() => {
              return Array.from(document.querySelectorAll('div, section, article')).length;
            });
            
            await this.page.waitForTimeout(1000);
            
            const afterElements = await this.page.evaluate(() => {
              return Array.from(document.querySelectorAll('div, section, article')).length;
            });
            
            if (afterElements > beforeElements) {
              console.log(`새로운 요소 감지됨: ${afterElements - beforeElements}개 요소 추가됨`);
              
              const highZIndexElement = await this.page.evaluate(() => {
                let highestZ = 0;
                let highestElement = null;
                
                const elements = document.querySelectorAll('div, section, article');
                for (const el of elements) {
                  const style = window.getComputedStyle(el);
                  const zIndex = parseInt(style.zIndex) || 0;
                  
                  if (zIndex > highestZ && style.display !== 'none' && style.visibility !== 'hidden') {
                    highestZ = zIndex;
                    highestElement = el;
                  }
                }
                
                return highestElement ? {
                  tagName: highestElement.tagName,
                  className: highestElement.className,
                  id: highestElement.id,
                  zIndex: highestZ
                } : null;
              });
              
              if (highZIndexElement) {
                console.log(`높은 z-index 요소 발견: ${JSON.stringify(highZIndexElement)}`);
              }
            }
          } catch (error) {
            console.warn(`새 요소 감지 중 오류: ${error.message}`);
          }
          
          console.warn('팝업 요소를 찾을 수 없습니다. 페이지 본문에서 정보 추출을 시도합니다.');
        }

        const contentDetail = await this.page.evaluate((popupSelector) => {
          const container = popupSelector ? document.querySelector(popupSelector) : document.body;
          
          if (!container) {
            return null;
          }

          const titleElement = container.querySelector('.content_title, .view_title, h1.title, .subject, .file-name, .detail-title, .popup-title') || 
            document.querySelector('.content_title, .view_title, h1.title, .subject, .file-name, .detail-title, .popup-title');
            
          const sizeElement = container.querySelector('.content_size, .file_size, .size, span:contains("용량"), .detail-size') || 
            document.querySelector('.content_size, .file_size, .size, span:contains("용량"), .detail-size');
            
          const priceElement = container.querySelector('.content_price, .price, .point, span:contains("포인트"), .detail-price') || 
            document.querySelector('.content_price, .price, .point, span:contains("포인트"), .detail-price');
            
          const uploaderElement = container.querySelector('.content_uploader, .uploader, .author, .username, .detail-uploader') || 
            document.querySelector('.content_uploader, .uploader, .author, .username, .detail-uploader');
            
          const partnershipElement = container.querySelector('.partnership_badge, .partner, .official, .vip-badge') || 
            document.querySelector('.partnership_badge, .partner, .official, .vip-badge');

          const fileListSelectors = [
            '.file_list li', '.files li', '.file-items div', 'table.files tr',
            '.detail-files li', '.popup-files li', '.file-table tr'
          ];
          
          let fileListElements = [];
          for (const selector of fileListSelectors) {
            const elements = container.querySelectorAll(selector) || document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
              fileListElements = Array.from(elements);
              break;
            }
          }

          const fileList = fileListElements.map(item => {
            const nameElement = item.querySelector('.file_name, .filename, a, td:first-child');
            const sizeElement = item.querySelector('.file_size, .filesize, .size, td:nth-child(2)');

            return {
              filename: nameElement ? nameElement.textContent.trim() : '',
              fileSize: sizeElement ? sizeElement.textContent.trim() : ''
            };
          });

          let price = '';
          let priceUnit = '포인트';

          if (priceElement) {
            price = priceElement.textContent.trim();
            const priceMatch = price.match(/(\d+)/);
            if (priceMatch) {
              price = priceMatch[1];
            }

            const unitMatch = price.match(/(\d+)\s*([^\d\s]+)/);
            if (unitMatch) {
              price = unitMatch[1];
              priceUnit = unitMatch[2];
            }
          }

          return {
            title: titleElement ? titleElement.textContent.trim() : '',
            fileSize: sizeElement ? sizeElement.textContent.trim() : '',
            price: price,
            priceUnit: priceUnit,
            uploaderId: uploaderElement ? uploaderElement.textContent.trim() : '',
            partnershipStatus: partnershipElement ? 'Y' : 'N',
            fileList: fileList
          };
        }, popupSelector);

        if (!contentDetail || !contentDetail.title) {
          throw new Error('컨텐츠 상세정보를 추출할 수 없음');
        }

        try {
          const closeButtonSelectors = [
            '.popup-close', '.close-button', '.btn-close', '.modal-close',
            '.layer_close', '.close', '[aria-label="Close"]', '.popup_close',
            
            '.detail_close', '.view_close', '.file_close', 'a.close', 'button.close',
            '.btn_close', '.layer-close', '.modal-close', '.popup-close',
            '.closeBtn', '.close-btn', '.popup-btn-close', '.layer-btn-close',
            
            '[class*="close"]', '[class*="Close"]', '[id*="close"]', '[id*="Close"]',
            'a[onclick*="close"]', 'button[onclick*="close"]', 'a[href*="close"]',
            'button[data-dismiss]', 'a[data-dismiss]', '[role="button"][aria-label*="close"]',
            
            '.btn_confirm', '.confirm-btn', '.btn-confirm', '.ok-btn', '.btn-ok',
            'button.confirm', 'input[type="button"][value="확인"]',
            
            '.detail-close', '.file-close', '.view-close', '.content-close',
            '.detail-layer-close', '.file-detail-close', '.view-detail-close'
          ];
          
          console.log('팝업 닫기 버튼 찾는 중...');
          let closed = false;
          
          for (const selector of closeButtonSelectors) {
            try {
              const closeButton = await this.page.$(selector);
              if (closeButton) {
                const isVisible = await this.page.evaluate(el => {
                  const style = window.getComputedStyle(el);
                  return style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0' &&
                         el.offsetWidth > 0 &&
                         el.offsetHeight > 0;
                }, closeButton);
                
                if (isVisible) {
                  console.log(`팝업 닫기 버튼 발견: ${selector}`);
                  await closeButton.click().catch(e => console.log(`버튼 클릭 실패: ${e.message}`));
                  console.log(`팝업 닫기 버튼 클릭됨: ${selector}`);
                  closed = true;
                  await this.page.waitForTimeout(500);
                  break;
                }
              }
            } catch (buttonError) {
              console.log(`버튼 선택자 '${selector}' 확인 중 오류: ${buttonError.message}`);
            }
          }
          
          if (!closed) {
            console.log('텍스트 내용으로 닫기 버튼 찾는 중...');
            
            const buttonByText = await this.page.evaluate(() => {
              const closeTexts = ['닫기', '확인', '확 인', 'Close', 'OK', '종료', 'X', '×'];
              const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], [role="button"]'));
              
              for (const button of buttons) {
                const buttonText = button.textContent?.trim() || button.value || '';
                if (closeTexts.some(text => buttonText.includes(text))) {
                  const style = window.getComputedStyle(button);
                  if (style.display !== 'none' && 
                      style.visibility !== 'hidden' && 
                      style.opacity !== '0' &&
                      button.offsetWidth > 0 &&
                      button.offsetHeight > 0) {
                    console.log(`텍스트로 닫기 버튼 발견: ${buttonText}`);
                    button.click();
                    return true;
                  }
                }
              }
              return false;
            });
            
            if (buttonByText) {
              console.log('텍스트 내용으로 닫기 버튼 클릭됨');
              closed = true;
              await this.page.waitForTimeout(500);
            }
          }
          
          if (!closed) {
            console.log('위치 기반으로 닫기 버튼 찾는 중...');
            
            const positionBasedButton = await this.page.evaluate(() => {
              const popupContainers = document.querySelectorAll(
                '.layer_popup, .modal-content, .popup-detail, .detail-layer, ' +
                '.content-view-popup, .content_detail_popup, [role="dialog"], ' +
                '.layer-popup, .view_layer, .content_view, .detail_view, ' +
                '.file_detail_layer, #detailPopup, .board_view_popup'
              );
              
              if (popupContainers.length > 0) {
                const container = popupContainers[0];
                const rect = container.getBoundingClientRect();
                
                const topRightElements = Array.from(document.querySelectorAll('button, a, span, div, img'))
                  .filter(el => {
                    const elRect = el.getBoundingClientRect();
                    return elRect.top < rect.top + 50 && // 상단 50px 이내
                           elRect.right > rect.right - 50 && // 오른쪽 50px 이내
                           elRect.width < 50 && elRect.height < 50 && // 작은 요소 (버튼)
                           window.getComputedStyle(el).display !== 'none' &&
                           window.getComputedStyle(el).visibility !== 'hidden';
                  });
                
                if (topRightElements.length > 0) {
                  console.log(`위치 기반으로 닫기 버튼 발견: ${topRightElements[0].tagName}`);
                  topRightElements[0].click();
                  return true;
                }
              }
              return false;
            });
            
            if (positionBasedButton) {
              console.log('위치 기반으로 닫기 버튼 클릭됨');
              closed = true;
              await this.page.waitForTimeout(500);
            }
          }
          
          if (!closed) {
            console.log('ESC 키로 팝업 닫기 시도');
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(500);
            
            await this.page.evaluate(() => {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
              document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', keyCode: 27 }));
            });
            
            console.log('ESC 키 이벤트 발생 완료');
          }
          
          await this.page.waitForTimeout(1000);
          console.log('팝업 닫기 처리 완료');
        } catch (error) {
          console.warn(`팝업 닫기 실패: ${error.message}`);
        }

        console.log(`컨텐츠 상세정보 추출 완료: ${contentDetail.title}`);
        return contentDetail;
      });
    } catch (error) {
      console.error(`컨텐츠 상세정보 가져오기 실패: ${error.message}`);
      return null;
    }
  }
  async getContentDetailByUrl(url) {
    try {
      console.log(`URL로 컨텐츠 상세정보 가져오기: ${url}`);

      if (!url) {
        console.error('URL이 제공되지 않음');
        return null;
      }

      return await retry(async () => {
        const response = await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });

        if (!response || !response.ok()) {
          throw new Error(`상세 페이지 로드 실패: ${response ? response.status() : 'No response'}`);
        }

        const detailSelector = '.content_detail, .view_content, .board_view, .file-detail';
        try {
          await this.page.waitForSelector(detailSelector, { timeout: this.config.timeout });
        } catch (error) {
          console.warn(`상세 페이지 요소 대기 시간 초과: ${error.message}`);
        }

        const contentDetail = await this.page.evaluate(() => {
          const detailSelectors = ['.content_detail', '.view_content', '.board_view', '.file-detail'];
          let detailContainer = null;

          for (const selector of detailSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              detailContainer = element;
              break;
            }
          }

          if (!detailContainer) {
            detailContainer = document.body;
          }

          const titleElement = document.querySelector('.content_title, .view_title, h1.title, .subject, .file-name');
          const sizeElement = document.querySelector('.content_size, .file_size, .size, span:contains("용량")');
          const priceElement = document.querySelector('.content_price, .price, .point, span:contains("포인트")');
          const uploaderElement = document.querySelector('.content_uploader, .uploader, .author, .username');
          const partnershipElement = document.querySelector('.partnership_badge, .partner, .official');

          const fileListSelectors = ['.file_list li', '.files li', '.file-items div', 'table.files tr'];
          let fileListElements = [];

          for (const selector of fileListSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
              fileListElements = Array.from(elements);
              break;
            }
          }

          const fileList = fileListElements.map(item => {
            const nameElement = item.querySelector('.file_name, .filename, a, td:first-child');
            const sizeElement = item.querySelector('.file_size, .filesize, .size, td:nth-child(2)');

            return {
              filename: nameElement ? nameElement.textContent.trim() : '',
              fileSize: sizeElement ? sizeElement.textContent.trim() : ''
            };
          });

          let price = '';
          let priceUnit = '포인트';

          if (priceElement) {
            price = priceElement.textContent.trim();
            const priceMatch = price.match(/(\d+)/);
            if (priceMatch) {
              price = priceMatch[1];
            }

            const unitMatch = price.match(/(\d+)\s*([^\d\s]+)/);
            if (unitMatch) {
              price = unitMatch[1];
              priceUnit = unitMatch[2];
            }
          }

          return {
            title: titleElement ? titleElement.textContent.trim() : '',
            fileSize: sizeElement ? sizeElement.textContent.trim() : '',
            price: price,
            priceUnit: priceUnit,
            uploaderId: uploaderElement ? uploaderElement.textContent.trim() : '',
            partnershipStatus: partnershipElement ? 'Y' : 'N',
            fileList: fileList
          };
        });

        if (!contentDetail || !contentDetail.title) {
          throw new Error('컨텐츠 상세정보를 추출할 수 없음');
        }

        console.log(`URL에서 컨텐츠 상세정보 추출 완료: ${contentDetail.title}`);
        return contentDetail;
      });
    } catch (error) {
      console.error(`URL에서 컨텐츠 상세정보 가져오기 실패: ${error.message}`);
      return null;
    }
  }


  async searchKeyword(keyword) {
    try {
      await this.page.waitForSelector('.search_input');

      await this.page.evaluate(() => {
        document.querySelector('.search_input').value = '';
      });

      await this.page.type('.search_input', keyword);

      await this.page.click('.search_button');

      try {
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.config.timeout });
      } catch (error) {
        console.warn('Navigation timeout:', error.message);
      }

      const searchResults = await this.getContentList();

      return searchResults;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }
  async goToNextPage(category, currentPage) {
    try {
      console.log(`다음 페이지로 이동 시도: 카테고리 ${category}, 현재 페이지 ${currentPage}`);
      
      const paginationSelectors = [
        `.pagination a[href*="page=${currentPage + 1}"]`,
        `.pagination a[href*="page_no=${currentPage + 1}"]`,
        `.pagination a[href*="pageNo=${currentPage + 1}"]`,
        `.pagination a[href*="pageIndex=${currentPage + 1}"]`,
        `.pagination .next`,
        `.pagination .next-page`,
        `.paging .next`,
        `.paging a[href*="page=${currentPage + 1}"]`,
        `a.next`,
        `a[aria-label="Next page"]`,
        `.board_paging a:nth-child(${currentPage + 1})`,
        `.board_paging a:contains("${currentPage + 1}")`,
        `.paging a:contains("${currentPage + 1}")`,
        `.pagination a:contains("다음")`,
        `.paging a:contains("다음")`,
        `.pagination a:contains(">")`,
        `.paging a:contains(">")`,
        `.pagination li:last-child a`,
        `.paging li:last-child a`
      ];
      
      for (const selector of paginationSelectors) {
        const nextPageLink = await this.page.$(selector);
        
        if (nextPageLink) {
          try {
            await Promise.all([
              this.page.waitForNavigation({ 
                waitUntil: 'networkidle2', 
                timeout: this.config.timeout 
              }),
              nextPageLink.click()
            ]);
            
            console.log(`다음 페이지로 이동 성공: 카테고리 ${category}, 페이지 ${currentPage + 1}`);
            
            await this.page.waitForSelector('.list_table, .board_list, .file_list, .content_list', { 
              timeout: this.config.timeout 
            }).catch(() => {
              console.log('콘텐츠 목록 선택자 타임아웃, 계속 진행합니다');
            });
            
            return true;
          } catch (error) {
            console.warn(`선택자 '${selector}'로 다음 페이지 이동 실패: ${error.message}`);
            continue;
          }
        }
      }
      
      try {
        const pageLinks = await this.page.$$('.pagination a, .paging a, .board_paging a');
        
        for (const link of pageLinks) {
          const linkText = await this.page.evaluate(el => el.textContent.trim(), link);
          
          if (linkText === String(currentPage + 1)) {
            await Promise.all([
              this.page.waitForNavigation({ 
                waitUntil: 'networkidle2', 
                timeout: this.config.timeout 
              }),
              link.click()
            ]);
            
            console.log(`페이지 번호 ${currentPage + 1}로 이동 성공`);
            return true;
          }
        }
      } catch (error) {
        console.warn(`페이지 번호 링크 검색 실패: ${error.message}`);
      }
      
      console.log(`다음 페이지 링크를 찾을 수 없음: 카테고리 ${category}, 페이지 ${currentPage}`);
      return false;
    } catch (error) {
      console.error(`다음 페이지로 이동 실패: ${error.message}`);
      return false;
    }
  }



  async captureScreenshot(selector, outputPath) {
    try {
      if (selector) {
        const element = await this.page.$(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        await element.screenshot({ path: outputPath });
      } else {
        await this.page.screenshot({ path: outputPath, fullPage: true });
      }

      return outputPath;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

export default BrowserService;
