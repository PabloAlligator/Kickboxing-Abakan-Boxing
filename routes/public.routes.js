const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();


router.get('/config', (_req, res) => {
  const rawPhone = String(process.env.PUBLIC_PHONE || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  const normalizedDigits = digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
  const phoneHref = normalizedDigits.length >= 10 ? `tel:+${normalizedDigits}` : null;
  const phoneDisplay = formatRussianPhone(normalizedDigits);
  const telegramUrl = safeTelegramUrl(process.env.TELEGRAM_URL);

  res.set('Cache-Control', 'public, max-age=300');
  return res.json({ phoneHref, phoneDisplay, telegramUrl });
});

function formatRussianPhone(digits) {
  if (/^7\d{10}$/.test(digits)) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return digits ? `+${digits}` : null;
}

function safeTelegramUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !['t.me', 'telegram.me'].includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

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

function safeJson(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = router;
