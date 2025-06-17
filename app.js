// app.js
import express from 'express';
import session from 'express-session';
import connectRedis from 'connect-redis';
import { createClient } from 'redis';
import crypto from 'crypto';

//////////////////////////
// Redis 설정
//////////////////////////
const RedisStore = connectRedis(session);
const redisClient = createClient({
  url: process.env.REDIS_URL,
});
redisClient.connect().catch(console.error);

// 반드시 new 로 인스턴스 생성 (connect-redis v6 문법)
const store = new RedisStore({
  client: redisClient,
  prefix: 'sess:',
});

//////////////////////////
// Express 앱
//////////////////////////
const app = express();
app.use(express.json());

app.use(
  session({
    store,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 5 }, // 5분
  })
);

// 1회용 토큰 생성 엔드포인트
app.get('/admin/generate', (req, res) => {
  const id = crypto.randomBytes(12).toString('hex');
  redisClient.setEx(`token:${id}`, 300, '1'); // 5분 TTL
  res.send(`${req.protocol}://${req.get('host')}/g/${id}`);
});

// 토큰 검증 미들웨어
app.get('/g/:id', async (req, res, next) => {
  const ok = await redisClient.getDel(`token:${req.params.id}`);
  if (!ok) return res.status(404).send('링크 만료');
  next();
});

// 실제 GPT 프록시 (예시)
app.get('/g/:id', (req, res) => {
  res.redirect('https://chat.openai.com'); // 필요 시 GPT 주소로 수정
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));

});

app.listen(process.env.PORT || 3000);
