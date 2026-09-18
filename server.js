require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const controlRoutes = require('./routes/control');
const prisma = require('./lib/prisma');
const { requireAuth, requireCsrf, sameOrigin } = require('./lib/security');
const { runReminderCycle } = require('./lib/push');
const PrismaSessionStore = require('./lib/prisma-session-store');

const ROOT = __dirname;

function createApp() {
  const app = express();
  const production = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET || 'development-only-session-secret-change-before-production-123456789';
  if (production && sessionSecret.length < 64) throw new Error('SESSION_SECRET должен содержать не менее 64 символов');

  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"]
      }
    }
  }));
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

  const store = process.env.NODE_ENV === 'test' ? undefined : new PrismaSessionStore();
  app.use(session({
    name: 'sodruzhestvo.sid',
    secret: sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: production,
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000
    }
  }));
  app.use(sameOrigin);

  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/control', requireAuth, requireCsrf, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, controlRoutes);

  app.get('/health', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  });

  app.get('/admin/login', (_req, res) => res.sendFile(path.join(ROOT, 'control', 'login.html')));
  app.get('/admin', (_req, res) => res.sendFile(path.join(ROOT, 'control', 'index.html')));
  app.get('/admin/*path', (_req, res) => res.sendFile(path.join(ROOT, 'control', 'index.html')));
  app.use('/control', express.static(path.join(ROOT, 'control'), { etag: true, maxAge: production ? '1h' : 0 }));
  app.use('/site', express.static(path.join(ROOT, 'site'), { etag: true, maxAge: production ? '7d' : 0 }));
  app.get('/manifest.webmanifest', (_req, res) => res.sendFile(path.join(ROOT, 'manifest.webmanifest')));
  app.get('/service-worker.js', (_req, res) => {
    res.set('Service-Worker-Allowed', '/');
    res.sendFile(path.join(ROOT, 'service-worker.js'));
  });
  app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'index.html')));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API-маршрут не найден' }));
  app.use((_req, res) => res.status(404).sendFile(path.join(ROOT, 'index.html')));
  app.use((error, req, res, _next) => {
    const status = error.status || (error.code === 'P2025' ? 404 : error.code === 'P2002' ? 409 : 500);
    if (status >= 500) console.error(req.method, req.originalUrl, error);
    const message = status >= 500 ? 'Внутренняя ошибка сервера' : error.message;
    if (req.originalUrl.startsWith('/api/')) return res.status(status).json({ error: message });
    return res.status(status).send(message);
  });

  return app;
}

function start() {
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => console.log(`Содружество запущено на http://localhost:${port}`));
  const reminderTimer = setInterval(() => runReminderCycle().catch((error) => console.error('Планировщик:', error.message)), 60 * 1000);
  reminderTimer.unref();
  const sessionCleanupTimer = setInterval(() => new PrismaSessionStore().clearExpired().catch((error) => console.error('Очистка сессий:', error.message)), 60 * 60 * 1000);
  sessionCleanupTimer.unref();
  const shutdown = async (signal) => {
    console.log(`${signal}: корректная остановка`);
    clearInterval(reminderTimer);
    clearInterval(sessionCleanupTimer);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

if (require.main === module) start();

module.exports = { createApp, start };
