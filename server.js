require('dotenv').config();

const path = require('node:path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');

const prisma = require('./lib/prisma');
const authRoutes = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const controlRoutes = require('./routes/control.routes');
const requireAuth = require('./middleware/require-auth');
const requireCsrf = require('./middleware/require-csrf');
const validateOrigin = require('./middleware/validate-origin');
const PrismaSessionStore = require('./services/prisma-session-store');
const { runReminderCycle } = require('./services/push.service');
const {
  IS_PRODUCTION,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} = require('./config/security');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const ADMIN_DIR = path.join(ROOT, 'admin-pages');
const SITE_DIR = path.join(ROOT, 'site');

const ADMIN_PAGES = new Set([
  'dashboard',
  'athletes',
  'groups',
  'attendance',
  'payments',
  'calendar',
  'personal',
  'tasks',
  'expenses',
  'statistics',
  'settings',
]);

function validateProductionEnv() {
  if (!IS_PRODUCTION) return;
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'APP_ORIGIN',
    'PUBLIC_PHONE',
    'TELEGRAM_URL',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
  ];
  const missing = required.filter(
    (key) => !String(process.env[key] || '').trim(),
  );
  if (missing.length)
    throw new Error(`Отсутствуют production ENV: ${missing.join(', ')}`);
  if (String(process.env.SESSION_SECRET).length < 64) {
    throw new Error('SESSION_SECRET должен содержать не менее 64 символов');
  }
  try {
    const origin = new URL(String(process.env.APP_ORIGIN));
    if (
      origin.protocol !== 'https:' ||
      origin.origin !== String(process.env.APP_ORIGIN)
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      'APP_ORIGIN в production должен быть HTTPS origin без пути и завершающего слеша',
    );
  }
  if (!/^\+?\d[\d\s()\-]{8,24}$/.test(String(process.env.PUBLIC_PHONE))) {
    throw new Error('PUBLIC_PHONE: укажите корректный телефон клуба');
  }
  if (!String(process.env.DATABASE_URL).startsWith('file:')) {
    throw new Error('DATABASE_URL должен использовать SQLite URL file:...');
  }
  if (!/^mailto:.+@.+\..+$/.test(String(process.env.VAPID_SUBJECT))) {
    throw new Error('VAPID_SUBJECT должен быть mailto:адрес');
  }
  try {
    const telegram = new URL(String(process.env.TELEGRAM_URL));
    if (
      telegram.protocol !== 'https:' ||
      !['t.me', 'telegram.me'].includes(telegram.hostname.toLowerCase())
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('TELEGRAM_URL должен быть корректной HTTPS-ссылкой t.me');
  }
}

function createApp() {
  validateProductionEnv();

  const app = express();
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'development-only-secret-change-before-production-0123456789abcdef0123456789abcdef';
  const sessionStore =
    process.env.NODE_ENV === 'test' ? undefined : new PrismaSessionStore();

  app.disable('x-powered-by');
  if (IS_PRODUCTION) app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: getSessionCookieOptions(),
    }),
  );

  app.use(validateOrigin);

  app.use('/api/public', publicRoutes);
  app.use('/api/admin/auth', authRoutes);
  app.use(
    '/api/admin',
    requireAuth.api,
    requireCsrf,
    (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    },
    controlRoutes,
  );

  app.get('/health', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, status: 'ok' });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/admin/login', (req, res) => {
    if (req.session?.user?.id) return res.redirect(303, '/admin/dashboard');
    return res.sendFile(path.join(ADMIN_DIR, 'login.html'));
  });

  app.get('/admin', requireAuth.page, (_req, res) =>
    res.redirect(302, '/admin/dashboard'),
  );
  app.get('/admin/:page', requireAuth.page, (req, res, next) => {
    if (!ADMIN_PAGES.has(req.params.page)) return next();
    res.set('Cache-Control', 'no-store');
    return res.sendFile(path.join(ADMIN_DIR, `${req.params.page}.html`));
  });

  const staticOptions = {
    etag: true,
    maxAge: IS_PRODUCTION ? '7d' : 0,
    immutable: false,
  };
  app.use(
    '/site/css',
    express.static(path.join(SITE_DIR, 'css'), staticOptions),
  );
  app.use(
    '/site/scripts',
    express.static(path.join(SITE_DIR, 'scripts'), staticOptions),
  );
  app.use(
    '/site/img',
    express.static(path.join(SITE_DIR, 'img'), staticOptions),
  );
  app.use(
    '/site/fonts',
    express.static(path.join(SITE_DIR, 'fonts'), staticOptions),
  );

  app.get('/manifest.webmanifest', (_req, res) => {
    res.set(
      'Cache-Control',
      IS_PRODUCTION ? 'public, max-age=3600' : 'no-cache',
    );
    return res.sendFile(path.join(ROOT, 'manifest.webmanifest'));
  });

  app.get('/service-worker.js', (_req, res) => {
    res.set('Service-Worker-Allowed', '/');
    res.set('Cache-Control', 'no-cache');
    return res.sendFile(path.join(ROOT, 'service-worker.js'));
  });

  app.get('/', (_req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'index.html')),
  );
  app.get('/robots.txt', (_req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'robots.txt')),
  );
  app.get('/sitemap.xml', (_req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'sitemap.xml')),
  );

  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'API-маршрут не найден' }),
  );
  app.use((_req, res) =>
    res.status(404).type('text/plain').send('Страница не найдена'),
  );

  app.use((error, req, res, _next) => {
    const status =
      error.status ||
      (error.code === 'P2025' ? 404 : error.code === 'P2002' ? 409 : 500);
    if (status >= 500) console.error(req.method, req.originalUrl, error);
    const message = status >= 500 ? 'Внутренняя ошибка сервера' : error.message;
    if (req.originalUrl.startsWith('/api/'))
      return res.status(status).json({ error: message });
    return res.status(status).type('text/plain').send(message);
  });

  app.locals.sessionStore = sessionStore;
  return app;
}

function start() {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () =>
    console.log(`Содружество запущено на http://localhost:${port}`),
  );
  const sessionStore = app.locals.sessionStore;

  const runReminders = () => {
    runReminderCycle().catch((error) =>
      console.error('Планировщик:', error.message),
    );
  };

  // Проверяем сразу после запуска
  runReminders();

  // Потом раз в минуту
  const reminderTimer = setInterval(runReminders, 60 * 1000);

  reminderTimer.unref();

  const sessionCleanupTimer = sessionStore
    ? setInterval(
        () => {
          sessionStore
            .clearExpired()
            .catch((error) => console.error('Очистка сессий:', error.message));
        },
        60 * 60 * 1000,
      )
    : null;
  sessionCleanupTimer?.unref();

  const shutdown = (signal) => {
    console.log(`${signal}: корректная остановка`);
    clearInterval(reminderTimer);
    if (sessionCleanupTimer) clearInterval(sessionCleanupTimer);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

if (require.main === module) start();

module.exports = { createApp, start };
