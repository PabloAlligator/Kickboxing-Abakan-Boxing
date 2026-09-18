const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/schedule', async (_req, res, next) => {
  try {
    const groups = await prisma.trainingGroup.findMany({
      where: { active: true, showPublic: true },
      select: { id: true, name: true, daysJson: true, startTime: true },
      orderBy: [{ startTime: 'asc' }, { name: 'asc' }]
    });
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      groups: groups.map((group) => ({
        ...group,
        days: safeJson(group.daysJson)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/settings', async (_req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'PUBLIC_TELEGRAM_URL' } });
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ telegramUrl: setting?.value || process.env.PUBLIC_TELEGRAM_URL || 'https://t.me/baikalov_art_trener' });
  } catch (error) {
    return next(error);
  }
});

function safeJson(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = router;
