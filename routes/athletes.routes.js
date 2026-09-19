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

router.get('/athletes', wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  const where = {
    status: req.query.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    ...(req.query.search ? { fullName: { contains: cleanText(req.query.search, 100) } } : {}),
    ...(req.query.groupId ? { memberships: { some: { groupId: id(req.query.groupId), active: true } } } : {})
  };
  const athletes = await prisma.athlete.findMany({
    where,
    include: {
      memberships: { where: { active: true }, include: { group: { select: { id: true, name: true } } } },
      payments: { where: { paymentDate: { gte: range.start, lt: range.end } }, select: { amountCents: true } },
      _count: { select: { attendances: { where: { present: true } } } }
    },
    orderBy: { fullName: 'asc' }
  });
  const paymentFilter = req.query.payment;
  const result = athletes.map((athlete) => ({
    ...athlete,
    paidCents: athlete.payments.reduce((sum, item) => sum + item.amountCents, 0),
    payments: undefined
  })).filter((athlete) => paymentFilter === 'paid' ? athlete.paidCents > 0 : paymentFilter === 'unpaid' ? athlete.paidCents === 0 : true);
  res.json({ month: range.month, athletes: result });
}));

router.get('/athletes/:athleteId', wrap(async (req, res) => {
  const athlete = await prisma.athlete.findUnique({
    where: { id: id(req.params.athleteId) },
    include: {
      memberships: { include: { group: true }, orderBy: { joinedAt: 'desc' } },
      payments: { orderBy: { paymentDate: 'desc' }, take: 50 },
      attendances: { include: { training: { include: { group: true } } }, orderBy: { markedAt: 'desc' }, take: 50 }
    }
  });
  if (!athlete) return res.status(404).json({ error: 'Спортсмен не найден' });
  return res.json({ athlete });
}));

router.post('/athletes', wrap(async (req, res) => {
  const athlete = await prisma.athlete.create({ data: {
    fullName: requiredText(req.body.fullName, 'ФИО', 200),
    startedAt: req.body.startedAt ? dateOnly(req.body.startedAt) : null,
    comment: optionalText(req.body.comment, 2000)
  } });
  if (req.body.groupId) {
    await prisma.groupMembership.create({ data: { athleteId: athlete.id, groupId: id(req.body.groupId, 'Группа') } });
  }
  await audit(req, 'ATHLETE_CREATED', 'Athlete', athlete.id);
  res.status(201).json({ athlete });
}));

router.put('/athletes/:athleteId', wrap(async (req, res) => {
  const athleteId = id(req.params.athleteId);
  const athlete = await prisma.$transaction(async (tx) => {
    const updated = await tx.athlete.update({ where: { id: athleteId }, data: {
      fullName: requiredText(req.body.fullName, 'ФИО', 200),
      startedAt: req.body.startedAt ? dateOnly(req.body.startedAt) : null,
      comment: optionalText(req.body.comment, 2000)
    } });
    if (req.body.groupId) {
      const groupId = id(req.body.groupId, 'Группа');
      await tx.groupMembership.updateMany({ where: { athleteId, active: true, groupId: { not: groupId } }, data: { active: false, leftAt: new Date() } });
      await tx.groupMembership.upsert({ where: { athleteId_groupId: { athleteId, groupId } }, create: { athleteId, groupId }, update: { active: true, leftAt: null } });
    }
    return updated;
  });
  await audit(req, 'ATHLETE_UPDATED', 'Athlete', athlete.id);
  res.json({ athlete });
}));

router.patch('/athletes/:athleteId/status', wrap(async (req, res) => {
  const athleteId = id(req.params.athleteId);
  const status = choice(req.body.status, ['ACTIVE', 'ARCHIVED'], 'Статус');
  const athlete = await prisma.athlete.update({ where: { id: athleteId }, data: { status } });
  if (status === 'ARCHIVED') {
    await prisma.groupMembership.updateMany({ where: { athleteId, active: true }, data: { active: false, leftAt: new Date() } });
  }
  await audit(req, 'ATHLETE_STATUS_CHANGED', 'Athlete', athlete.id, { status });
  res.json({ athlete });
}));


router.delete('/athletes/:athleteId', wrap(async (req, res) => {
  const athleteId = id(req.params.athleteId);

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      fullName: true,
      status: true,
    },
  });

  if (!athlete) {
    return res.status(404).json({ error: 'Спортсмен не найден' });
  }

  if (athlete.status !== 'ARCHIVED') {
    return res.status(409).json({
      error: 'Сначала перенесите спортсмена в архив',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupPayment.deleteMany({ where: { athleteId } });
    await tx.attendance.deleteMany({ where: { athleteId } });
    await tx.groupMembership.deleteMany({ where: { athleteId } });
    await tx.athlete.delete({ where: { id: athleteId } });
  });

  await audit(req, 'ATHLETE_DELETED', 'Athlete', athleteId, {
    fullName: athlete.fullName,
  });

  return res.status(204).end();
}));

module.exports = router;
