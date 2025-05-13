# 웹 사이트 모니터링 시스템

웹 사이트 콘텐츠 모니터링 시스템으로, 특정 사이트를 로그인하고 크롤링하여 모니터링합니다.

## 시스템 요구사항

### 기본 요구사항
- Node.js v18.0.0 이상
- npm v7.0.0 이상

## 설치 방법

```bash
# 저장소 클론
git clone https://github.com/inautes/monitoring.git

# 의존성 설치
cd monitoring
npm install
```

## 환경 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 환경 변수를 설정합니다.

```bash
cp .env.example .env
```

주요 환경 변수:
- `FILEIS_USERNAME`: 로그인 아이디
- `FILEIS_PASSWORD`: 로그인 비밀번호
- `HEADLESS`: 헤드리스 모드 사용 여부 (true/false)
- `BROWSER_TIMEOUT`: 브라우저 타임아웃 시간 (밀리초)

## 실행 방법

```bash
# 개발 모드 실행
npm run dev

# 프로덕션 모드 실행
npm start
```

## 테스트

로그인 테스트를 실행하려면:

```bash
node test-fallback/test-login.js
```

## 프로젝트 구조

- `src/`: 소스 코드
  - `app.js`: 메인 애플리케이션
  - `controllers/`: 컨트롤러 (MVC)
  - `models/`: 데이터베이스 모델 (Sequelize)
  - `services/`: 서비스 (브라우저, 크롤러 등)
  - `views/`: 뷰 템플릿
- `test-fallback/`: 테스트 코드
