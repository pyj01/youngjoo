import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import connectRedis from 'connect-redis';

const app = express();
const redis = new Redis(process.env.REDIS_URL);
const RedisStore = connectRedis(session);

app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, maxAge: 1000 * 60 * 60 * 24 * 365 },
}));

app.use('/admin', (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (auth === 'Basic ' + Buffer.from('admin:yourpassword').toString('base64')) return next();
  res.set('WWW-Authenticate', 'Basic realm="관리자"');
  return res.status(401).send('인증 필요');
});

app.get('/admin/generate', async (_req, res) => {
  const token = uuid();
  await redis.setex(`token:${token}`, 60 * 60, 'valid');
  res.send(`https://${process.env.DOMAIN}/g/${token}`);
});

app.get('/g/:token', async (req, res) => {
  const ok = await redis.del(`token:${req.params.token}`);
  if (!ok) return res.status(404).send('링크 만료');
  req.session.isSubscriber = true;
  res.redirect('/access');
});

app.get('/access', (req, res) => {
  if (!req.session.isSubscriber) return res.status(403).send('구독자 전용');
  res.redirect('https://chat.openai.com/g/XXXXXXXX');  // ← 당신의 GPT 주소로 교체
});

app.listen(process.env.PORT || 3000);
