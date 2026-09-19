const express = require('express');
const prisma = require('../lib/prisma');
const audit = require('../services/audit.service');
const { pushConfigured } = require('../services/push.service');
const { wrap } = require('./route-helpers');
const {
  choice,
  cleanText,
  date,
  dateOnly,
  id,
  monthRange,
  optionalText,
  positiveCents,
  requiredText,
  time
} = require('../lib/validation');

const router = express.Router();

router.get('/push/status', (_req, res) => {
  res.json({ configured: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

router.post('/push/subscribe', wrap(async (req, res) => {
  const endpoint = requiredText(req.body.endpoint, 'Endpoint', 3000);
  const p256dh = requiredText(req.body.keys?.p256dh, 'p256dh', 1000);
  const auth = requiredText(req.body.keys?.auth, 'auth', 1000);
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { ownerId: req.session.user.id, endpoint, p256dh, auth, userAgent: cleanText(req.get('user-agent'), 500) || null },
    update: { ownerId: req.session.user.id, p256dh, auth, userAgent: cleanText(req.get('user-agent'), 500) || null }
  });
  res.status(201).json({ subscription: { id: subscription.id } });
}));

router.delete('/push/subscribe', wrap(async (req, res) => {
  const endpoint = requiredText(req.body.endpoint, 'Endpoint', 3000);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, ownerId: req.session.user.id } });
  res.status(204).end();
}));

router.get('/settings', wrap(async (_req, res) => {
  res.json({ pushConfigured: pushConfigured() });
}));

router.get('/audit-log', wrap(async (_req, res) => {
  const entries = await prisma.auditLog.findMany({ include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ entries });
}));

module.exports = router;
