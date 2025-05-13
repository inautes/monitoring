# 웹 사이트 모니터링 시스템 구현 문서

## 프로젝트 개요
이 프로젝트는 fileis.com 웹사이트를 로그인하고 크롤링하여 모니터링하는 시스템입니다. MVC 패턴을 기반으로 구현되었으며, Node.js와 Sequelize ORM을 사용하여 데이터베이스를 관리합니다.

## 시스템 아키텍처

### MVC 구조
- **모델(Model)**: Sequelize ORM을 사용하여 데이터베이스 모델 구현
- **뷰(View)**: EJS 템플릿 엔진을 사용한 웹 인터페이스
- **컨트롤러(Controller)**: 비즈니스 로직 처리 및 모델-뷰 연결

### 주요 구성 요소
1. **브라우저 서비스**: Puppeteer를 사용한 헤드리스 브라우저 자동화
2. **데이터베이스 서비스**: Sequelize ORM을 사용한 데이터 관리
3. **API 서버**: Express 기반 RESTful API
4. **크롤러 서비스**: 웹 콘텐츠 수집 및 분석

## 데이터베이스 모델

### OSP (사이트 정보)
- site_id: 사이트 식별자
- site_name: 사이트 이름
- site_type: 사이트 유형
- site_equ: 사이트 설정
- login_id: 로그인 아이디
- login_pw: 로그인 비밀번호

### Content (콘텐츠 정보)
- crawl_id: 크롤링 식별자 (기본 키)
- site_id: 사이트 식별자 (외래 키)
- content_id: 콘텐츠 식별자
- title: 제목
- genre: 장르
- file_count: 파일 수
- file_size: 파일 크기
- uploader_id: 업로더 아이디
- collection_time: 수집 시간
- detail_url: 상세 페이지 URL

### ContentDetail (콘텐츠 상세 정보)
- crawl_id: 크롤링 식별자 (기본 키, 외래 키)
- collection_time: 수집 시간
- price: 가격
- price_unit: 가격 단위
- partnership_status: 파트너십 상태
- capture_filename: 캡처 파일명
- status: 상태

### FileList (파일 목록)
- id: 식별자 (기본 키)
- crawl_id: 크롤링 식별자 (외래 키)
- filename: 파일명
- file_size: 파일 크기

## 주요 기능

### 1. 로그인 기능
- Puppeteer를 사용한 자동 로그인
- 로그인 상태 확인 및 세션 유지
- 오류 처리 및 재시도 메커니즘

### 2. API 엔드포인트
- `/api/auth/login/:siteId`: 사이트 로그인
- `/api/auth/logout`: 로그아웃

## 환경 설정
`.env` 파일을 통해 다양한 설정을 관리합니다:
- 로그인 정보 (FILEIS_USERNAME, FILEIS_PASSWORD)
- 브라우저 설정 (HEADLESS, BROWSER_TIMEOUT)
- 데이터베이스 설정 (DB_PATH)
- FTP 설정 (선택적)
- 모니터링 키워드 (TARGET_KEYWORD)

## 실행 방법

### 기본 실행
```bash
npm start
```

### API 서버 실행
```bash
npm run api
```

### 로그인 테스트
```bash
npm test
```

## 확장 계획
현재는 fileis.com 사이트에 대한 로그인 기능만 구현되어 있으며, 향후 다음 기능을 추가할 예정입니다:
1. 다양한 사이트 지원
2. 콘텐츠 크롤링 및 분석
3. 알림 시스템
4. 대시보드 UI

## 개발자 가이드
새로운 기능을 추가하려면 MVC 패턴을 따라 개발하세요:
1. 모델: `src/models/` 디렉토리에 새 모델 추가
2. 컨트롤러: `src/controllers/` 디렉토리에 새 컨트롤러 추가
3. 라우트: `src/routes/` 디렉토리에 새 라우트 추가
4. 뷰: `src/views/` 디렉토리에 새 템플릿 추가
