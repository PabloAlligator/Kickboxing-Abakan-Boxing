const express = require('express');
const prisma = require('../lib/prisma');
const audit = require('../services/audit.service');
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

router.get('/calendar', wrap(async (req, res) => {
  const from = req.query.from ? dateOnly(req.query.from) : new Date();
  const to = req.query.to ? new Date(dateOnly(req.query.to).getTime() + 86400000) : new Date(Date.now() + 31 * 86400000);
  const [groupTrainings, personalTrainings] = await Promise.all([
    prisma.groupTraining.findMany({ where: { trainingDate: { gte: from, lt: to } }, include: { group: { select: { name: true } } }, orderBy: [{ trainingDate: 'asc' }, { startTime: 'asc' }] }),
    prisma.personalTraining.findMany({ where: { ownerId: req.session.user.id, startsAt: { gte: from, lt: to }, status: { not: 'CANCELLED' } }, include: { client: { select: { name: true } } }, orderBy: { startsAt: 'asc' } })
  ]);
  res.json({ groupTrainings, personalTrainings });
}));

module.exports = router;
