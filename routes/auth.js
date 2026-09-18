const express = require('express');
const argon2 = require('argon2');
const { rateLimit } = require('express-rate-limit');
const prisma = require('../lib/prisma');
const audit = require('../lib/audit');
const { cleanText } = require('../lib/validation');
const {
  createCsrfToken,
  destroySession,
  regenerateSession,
  requireAuth,
  requireCsrf
} = require('../lib/security');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Повторите позже.' }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = cleanText(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    const valid = user?.active && user.role === 'OWNER' && (await argon2.verify(user.passwordHash, password));
    if (!valid) {
      await audit(req, 'LOGIN_FAILED', 'User', user?.id, { emailProvided: Boolean(email) });
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    await regenerateSession(req);
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    const csrfToken = createCsrfToken(req);
    await audit(req, 'LOGIN', 'User', user.id);
    return res.json({ user: req.session.user, csrfToken });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user, csrfToken: createCsrfToken(req) });
});

router.post('/logout', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    await audit(req, 'LOGOUT', 'User', req.session.user.id);
    await destroySession(req);
    res.clearCookie('sodruzhestvo.sid');
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
