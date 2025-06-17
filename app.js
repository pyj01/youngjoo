// app.js (수정본)
import express from 'express';
import session from 'express-session';
import connectRedis from 'connect-redis';
import { createClient } from 'redis';
import crypto from 'crypto';

//////////////// Redis //////////////////
const RedisStore = connectRedis(session);
const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();           // Node 22 async top-level OK

const store = new RedisStore({
  client: redisClient,
  prefix: 'sess:',
});

//////////////// Express ////////////////
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

// ---------- 관리자: 1회용 링크 발급 ----------
app.get('/admin/generate', (req, res) => {
  const id = crypto.randomBytes(12).toString('hex');
  redisClient.set(`token:${id}`, '1', { EX: 300 }); // 5분 TTL
  res.send(`${req.protocol}://${req.get('host')}/g/${id}`);
});

// ---------- 토큰 검증 후 GPT로 프록시 ----------
app.get('/g/:id', async (req, res) => {
  const ok = await redisClient.getDel(`token:${req.params.id}`);
  if (!ok) return res.status(404).send('링크 만료');
  // 필요 시 GPT 주소 변경
  res.redirect('https://chat.openai.com');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
