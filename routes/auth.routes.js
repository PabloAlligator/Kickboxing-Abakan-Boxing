const express = require('express');
const argon2 = require('argon2');
const { rateLimit } = require('express-rate-limit');
const prisma = require('../lib/prisma');
const audit = require('../services/audit.service');
const { cleanText } = require('../lib/validation');
const requireAuth = require('../middleware/require-auth');
const requireCsrf = require('../middleware/require-csrf');
const { createCsrfToken, destroySession, regenerateSession } = require('../services/session.service');
const { SESSION_COOKIE_NAME, getSessionCookieClearOptions } = require('../config/security');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Повторите позже.' },
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const login = cleanText(req.body.login, 64).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = login ? await prisma.user.findUnique({ where: { login } }) : null;
    const valid = user?.active && user.role === 'OWNER' && password && await argon2.verify(user.passwordHash, password);

    if (!valid) {
      await audit(req, 'LOGIN_FAILED', 'User', user?.id, { loginProvided: Boolean(login) });
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    await regenerateSession(req);
    req.session.user = { id: user.id, name: user.name, login: user.login, role: user.role };
    const csrfToken = createCsrfToken(req);
    await audit(req, 'LOGIN', 'User', user.id);
    return res.json({ user: req.session.user, csrfToken });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth.api, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ user: req.session.user, csrfToken: createCsrfToken(req) });
});

router.post('/logout', requireAuth.api, requireCsrf, async (req, res, next) => {
  try {
    await audit(req, 'LOGOUT', 'User', req.session.user.id);
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieClearOptions());
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
