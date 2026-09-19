const crypto = require('node:crypto');

module.exports = function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const supplied = req.get('x-csrf-token');
  const stored = req.session?.csrfToken;

  if (!supplied || !stored || supplied.length !== stored.length) {
    return res.status(403).json({ error: 'Недействительный CSRF-токен' });
  }

  const valid = crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(stored));
  if (!valid) return res.status(403).json({ error: 'Недействительный CSRF-токен' });
  return next();
};
