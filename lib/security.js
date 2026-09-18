const crypto = require('node:crypto');

function createCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function requireAuth(req, res, next) {
  if (!req.session?.user?.id) return res.status(401).json({ error: 'Сессия истекла. Войдите снова.' });
  return next();
}

function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const supplied = req.get('x-csrf-token');
  const stored = req.session?.csrfToken;
  if (!supplied || !stored || supplied.length !== stored.length) {
    return res.status(403).json({ error: 'Недействительный CSRF-токен' });
  }
  const valid = crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(stored));
  if (!valid) return res.status(403).json({ error: 'Недействительный CSRF-токен' });
  return next();
}

function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const expected = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
  if (origin !== expected) return res.status(403).json({ error: 'Запрос с другого источника запрещён' });
  return next();
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

function destroySession(req) {
  return new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
}

module.exports = { createCsrfToken, destroySession, regenerateSession, requireAuth, requireCsrf, sameOrigin };
