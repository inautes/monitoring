import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

import demoController from './controllers/demoController.js';
import monitoringController from './controllers/monitoringController.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', demoController.getIndex);
app.get('/category/:id', demoController.getCategory);
app.get('/detail/:id', demoController.getContentDetail);
app.get('/search', demoController.getSearch);
app.get('/status', demoController.getMonitoringStatus);

app.post('/api/monitoring/start', monitoringController.startMonitoring);
app.post('/api/monitoring/stop', monitoringController.stopMonitoring);
app.get('/api/monitoring/status', monitoringController.getStatus);
app.get('/api/monitoring/results', monitoringController.getResults);
app.get('/api/monitoring/categories', monitoringController.getCategories);
app.get('/api/monitoring/content/:id', monitoringController.getContentList);
app.get('/api/monitoring/detail/:id', monitoringController.getContentDetail);
app.get('/api/monitoring/search', monitoringController.searchByKeyword);

app.get('/monitoring', (req, res) => {
  res.render('monitoring', {
    title: 'Laon Monitoring - 실시간 모니터링'
  });
});

app.listen(PORT, () => {
  console.log(`
=======================================================
  Laon Monitoring System
=======================================================
  서버가 http://localhost:${PORT} 에서 실행 중입니다.
  
  사용 가능한 라우트:
  - 홈: http://localhost:${PORT}/
  - 카테고리: http://localhost:${PORT}/category/CG001
  - 상세 정보: http://localhost:${PORT}/detail/content001
  - 검색: http://localhost:${PORT}/search?keyword=폭싹속았수다
  - 상태: http://localhost:${PORT}/status
  - 실시간 모니터링: http://localhost:${PORT}/monitoring
  
=======================================================
`);
});
