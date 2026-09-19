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

router.get('/trainings', wrap(async (req, res) => {
  const from = req.query.from ? dateOnly(req.query.from) : new Date(Date.now() - 31 * 86400000);
  const to = req.query.to ? new Date(dateOnly(req.query.to).getTime() + 86400000) : new Date(Date.now() + 31 * 86400000);
  const trainings = await prisma.groupTraining.findMany({
    where: { trainingDate: { gte: from, lt: to }, ...(req.query.groupId ? { groupId: id(req.query.groupId) } : {}) },
    include: { group: true, _count: { select: { attendances: { where: { present: true } } } } },
    orderBy: [{ trainingDate: 'asc' }, { startTime: 'asc' }]
  });
  res.json({ trainings });
}));

router.post('/trainings', wrap(async (req, res) => {
  const groupId = id(req.body.groupId, 'Группа');
  const group = await prisma.trainingGroup.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });
  const trainingDate = dateOnly(req.body.trainingDate);
  const training = await prisma.groupTraining.upsert({
    where: { groupId_trainingDate: { groupId, trainingDate } },
    create: { groupId, trainingDate, startTime: req.body.startTime ? time(req.body.startTime) : group.startTime, note: optionalText(req.body.note) },
    update: { startTime: req.body.startTime ? time(req.body.startTime) : group.startTime, note: optionalText(req.body.note) }
  });
  res.status(201).json({ training });
}));

router.get('/trainings/:trainingId/attendance', wrap(async (req, res) => {
  const training = await prisma.groupTraining.findUnique({
    where: { id: id(req.params.trainingId) },
    include: {
      group: { include: { memberships: { where: { active: true }, include: { athlete: true } } } },
      attendances: true
    }
  });
  if (!training) return res.status(404).json({ error: 'Тренировка не найдена' });
  const attendance = new Map(training.attendances.map((item) => [item.athleteId, item.present]));
  res.json({ training: { id: training.id, trainingDate: training.trainingDate, startTime: training.startTime, group: { id: training.group.id, name: training.group.name } }, athletes: training.group.memberships.map(({ athlete }) => ({ id: athlete.id, fullName: athlete.fullName, present: attendance.get(athlete.id) || false })) });
}));

router.put('/trainings/:trainingId/attendance', wrap(async (req, res) => {
  const trainingId = id(req.params.trainingId);
  const training = await prisma.groupTraining.findUnique({ where: { id: trainingId }, include: { group: { include: { memberships: { where: { active: true }, select: { athleteId: true } } } } } });
  if (!training) return res.status(404).json({ error: 'Тренировка не найдена' });
  const allowed = new Set(training.group.memberships.map((item) => item.athleteId));
  const entries = Array.isArray(req.body.attendance) ? req.body.attendance : [];
  if (entries.some((item) => !allowed.has(Number(item.athleteId)))) return res.status(403).json({ error: 'Спортсмен не состоит в этой группе' });
  await prisma.$transaction(entries.map((item) => prisma.attendance.upsert({
    where: { trainingId_athleteId: { trainingId, athleteId: id(item.athleteId) } },
    create: { trainingId, athleteId: id(item.athleteId), present: Boolean(item.present) },
    update: { present: Boolean(item.present), markedAt: new Date() }
  })));
  await audit(req, 'ATTENDANCE_SAVED', 'GroupTraining', trainingId, { count: entries.length });
  res.json({ saved: entries.length });
}));

module.exports = router;
