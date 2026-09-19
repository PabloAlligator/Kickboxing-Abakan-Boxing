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

router.get('/personal/clients', wrap(async (req, res) => {
  const clients = await prisma.personalClient.findMany({
    where: { ownerId: req.session.user.id, archived: req.query.archived === 'true' },
    include: { trainings: { orderBy: { startsAt: 'desc' } } },
    orderBy: { name: 'asc' }
  });
  res.json({ clients });
}));

router.post('/personal/clients', wrap(async (req, res) => {
  const client = await prisma.personalClient.create({ data: {
    ownerId: req.session.user.id,
    name: requiredText(req.body.name, 'Имя', 160),
    notes: optionalText(req.body.notes, 3000)
  } });
  await audit(req, 'PERSONAL_CLIENT_CREATED', 'PersonalClient', client.id);
  res.status(201).json({ client });
}));

router.get('/personal/clients/:clientId', wrap(async (req, res) => {
  const client = await prisma.personalClient.findFirst({
    where: { id: id(req.params.clientId), ownerId: req.session.user.id },
    include: { trainings: { orderBy: { startsAt: 'desc' } } }
  });
  if (!client) return res.status(404).json({ error: 'Персональный клиент не найден' });
  return res.json({ client });
}));

router.put('/personal/clients/:clientId', wrap(async (req, res) => {
  const clientId = id(req.params.clientId);
  const existing = await prisma.personalClient.findFirst({ where: { id: clientId, ownerId: req.session.user.id } });
  if (!existing) return res.status(404).json({ error: 'Персональный клиент не найден' });
  const client = await prisma.personalClient.update({ where: { id: clientId }, data: {
    name: requiredText(req.body.name, 'Имя', 160),
    notes: optionalText(req.body.notes, 3000),
    archived: Boolean(req.body.archived)
  } });
  await audit(req, 'PERSONAL_CLIENT_UPDATED', 'PersonalClient', client.id);
  return res.json({ client });
}));

router.get('/personal/trainings', wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  const trainings = await prisma.personalTraining.findMany({
    where: { ownerId: req.session.user.id, ...(req.query.all === 'true' ? {} : { startsAt: { gte: range.start, lt: range.end } }) },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { startsAt: 'desc' }
  });
  const completed = trainings.filter((item) => item.status === 'COMPLETED');
  const upcoming = await prisma.personalTraining.count({ where: { ownerId: req.session.user.id, status: 'SCHEDULED', startsAt: { gte: new Date() } } });
  const clients = await prisma.personalClient.count({ where: { ownerId: req.session.user.id, archived: false } });
  res.json({ month: range.month, trainings, stats: { clients, completed: completed.length, incomeCents: completed.reduce((sum, item) => sum + item.priceCents, 0), upcoming } });
}));

router.post('/personal/trainings', wrap(async (req, res) => {
  const clientId = id(req.body.clientId, 'Клиент');
  const client = await prisma.personalClient.findFirst({ where: { id: clientId, ownerId: req.session.user.id, archived: false } });
  if (!client) return res.status(404).json({ error: 'Персональный клиент не найден' });
  const reminderMinutes = req.body.reminderMinutes == null || req.body.reminderMinutes === '' ? null : Number(req.body.reminderMinutes);
  if (reminderMinutes != null && ![120, 1440].includes(reminderMinutes)) return res.status(400).json({ error: 'Некорректное напоминание' });
  const training = await prisma.personalTraining.create({ data: {
    ownerId: req.session.user.id,
    clientId,
    startsAt: date(req.body.startsAt),
    priceCents: positiveCents(req.body.priceCents),
    status: choice(req.body.status || 'SCHEDULED', ['SCHEDULED', 'COMPLETED', 'CANCELLED'], 'Статус'),
    comment: optionalText(req.body.comment, 3000),
    reminderMinutes
  }, include: { client: { select: { name: true } } } });
  await audit(req, 'PERSONAL_TRAINING_CREATED', 'PersonalTraining', training.id);
  res.status(201).json({ training });
}));

router.get('/personal/trainings/:trainingId', wrap(async (req, res) => {
  const training = await prisma.personalTraining.findFirst({
    where: { id: id(req.params.trainingId), ownerId: req.session.user.id },
    include: { client: true }
  });
  if (!training) return res.status(404).json({ error: 'Персональная тренировка не найдена' });
  return res.json({ training });
}));

router.put('/personal/trainings/:trainingId', wrap(async (req, res) => {
  const trainingId = id(req.params.trainingId);
  const existing = await prisma.personalTraining.findFirst({ where: { id: trainingId, ownerId: req.session.user.id } });
  if (!existing) return res.status(404).json({ error: 'Персональная тренировка не найдена' });
  let reminderMinutes = existing.reminderMinutes;
  if (req.body.reminderMinutes !== undefined) {
    reminderMinutes = req.body.reminderMinutes === null || req.body.reminderMinutes === '' ? null : Number(req.body.reminderMinutes);
    if (reminderMinutes != null && ![120, 1440].includes(reminderMinutes)) {
      return res.status(400).json({ error: 'Некорректное напоминание' });
    }
  }
  const training = await prisma.personalTraining.update({ where: { id: trainingId }, data: {
    startsAt: req.body.startsAt ? date(req.body.startsAt) : existing.startsAt,
    priceCents: req.body.priceCents ? positiveCents(req.body.priceCents) : existing.priceCents,
    status: choice(req.body.status || existing.status, ['SCHEDULED', 'COMPLETED', 'CANCELLED'], 'Статус'),
    comment: req.body.comment === undefined ? existing.comment : optionalText(req.body.comment, 3000),
    reminderMinutes,
    reminderSentAt: req.body.startsAt !== undefined || req.body.reminderMinutes !== undefined ? null : existing.reminderSentAt
  } });
  await audit(req, 'PERSONAL_TRAINING_UPDATED', 'PersonalTraining', training.id, { status: training.status });
  return res.json({ training });
}));

module.exports = router;
