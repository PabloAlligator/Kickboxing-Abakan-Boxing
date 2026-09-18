const express = require('express');
const prisma = require('../lib/prisma');
const audit = require('../lib/audit');
const { pushConfigured } = require('../lib/push');
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
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function safeDays(value) {
  const days = Array.isArray(value) ? value : [];
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))];
}

function parseDays(value) {
  try {
    return safeDays(JSON.parse(value));
  } catch {
    return [];
  }
}

router.get('/dashboard', wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const [athletes, payments, expenses, tasks, visits, todayTrainings, latestPayments, latestExpenses] = await Promise.all([
    prisma.athlete.count({ where: { status: 'ACTIVE' } }),
    prisma.groupPayment.aggregate({ where: { paymentDate: { gte: range.start, lt: range.end } }, _sum: { amountCents: true } }),
    prisma.expense.aggregate({ where: { expenseDate: { gte: range.start, lt: range.end } }, _sum: { amountCents: true } }),
    prisma.clubTask.count({ where: { completed: false } }),
    prisma.attendance.count({ where: { present: true, training: { trainingDate: { gte: todayStart, lt: todayEnd } } } }),
    prisma.groupTraining.findMany({ where: { trainingDate: { gte: todayStart, lt: todayEnd } }, include: { group: true }, orderBy: { startTime: 'asc' } }),
    prisma.groupPayment.findMany({ include: { athlete: { select: { fullName: true } } }, orderBy: { paymentDate: 'desc' }, take: 5 }),
    prisma.expense.findMany({ include: { category: true }, orderBy: { expenseDate: 'desc' }, take: 5 })
  ]);
  const income = payments._sum.amountCents || 0;
  const spending = expenses._sum.amountCents || 0;
  res.json({ month: range.month, athletes, income, expenses: spending, difference: income - spending, tasks, visits, todayTrainings, latestPayments, latestExpenses });
}));

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
    expectedPaymentCents: req.body.expectedPaymentCents ? positiveCents(req.body.expectedPaymentCents) : null,
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
      expectedPaymentCents: req.body.expectedPaymentCents ? positiveCents(req.body.expectedPaymentCents) : null,
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

router.get('/groups', wrap(async (_req, res) => {
  const groups = await prisma.trainingGroup.findMany({
    include: {
      coaches: { include: { user: { select: { id: true, name: true } } } },
      memberships: { where: { active: true }, include: { athlete: { select: { id: true, fullName: true, status: true } } } }
    },
    orderBy: [{ active: 'desc' }, { startTime: 'asc' }]
  });
  res.json({ groups: groups.map((group) => ({ ...group, days: parseDays(group.daysJson), daysJson: undefined })) });
}));

router.post('/groups', wrap(async (req, res) => {
  const coachIds = Array.isArray(req.body.coachIds) ? req.body.coachIds.map((value) => id(value, 'Тренер')) : [];
  const group = await prisma.trainingGroup.create({ data: {
    name: requiredText(req.body.name, 'Название', 120),
    startTime: time(req.body.startTime),
    daysJson: JSON.stringify(safeDays(req.body.days)),
    showPublic: req.body.showPublic !== false,
    coaches: { create: coachIds.map((userId) => ({ userId })) }
  } });
  await audit(req, 'GROUP_CREATED', 'TrainingGroup', group.id);
  res.status(201).json({ group });
}));

router.put('/groups/:groupId', wrap(async (req, res) => {
  const groupId = id(req.params.groupId);
  const coachIds = Array.isArray(req.body.coachIds) ? req.body.coachIds.map((value) => id(value, 'Тренер')) : [];
  const group = await prisma.$transaction(async (tx) => {
    await tx.groupCoach.deleteMany({ where: { groupId } });
    return tx.trainingGroup.update({ where: { id: groupId }, data: {
      name: requiredText(req.body.name, 'Название', 120),
      startTime: time(req.body.startTime),
      daysJson: JSON.stringify(safeDays(req.body.days)),
      active: req.body.active !== false,
      showPublic: req.body.showPublic !== false,
      coaches: { create: coachIds.map((userId) => ({ userId })) }
    } });
  });
  await audit(req, 'GROUP_UPDATED', 'TrainingGroup', group.id);
  res.json({ group });
}));

router.post('/groups/:groupId/members', wrap(async (req, res) => {
  const groupId = id(req.params.groupId);
  const athleteId = id(req.body.athleteId, 'Спортсмен');
  const membership = await prisma.groupMembership.upsert({
    where: { athleteId_groupId: { athleteId, groupId } },
    create: { athleteId, groupId },
    update: { active: true, leftAt: null }
  });
  await audit(req, 'GROUP_MEMBER_ADDED', 'GroupMembership', membership.id);
  res.status(201).json({ membership });
}));

router.delete('/groups/:groupId/members/:athleteId', wrap(async (req, res) => {
  const groupId = id(req.params.groupId);
  const athleteId = id(req.params.athleteId);
  const membership = await prisma.groupMembership.update({
    where: { athleteId_groupId: { athleteId, groupId } },
    data: { active: false, leftAt: new Date() }
  });
  await audit(req, 'GROUP_MEMBER_REMOVED', 'GroupMembership', membership.id);
  res.status(204).end();
}));

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

router.get('/payments', wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  const payments = await prisma.groupPayment.findMany({
    where: { paymentDate: { gte: range.start, lt: range.end }, ...(req.query.athleteId ? { athleteId: id(req.query.athleteId) } : {}) },
    include: { athlete: { select: { id: true, fullName: true } } },
    orderBy: { paymentDate: 'desc' }
  });
  res.json({ month: range.month, totalCents: payments.reduce((sum, item) => sum + item.amountCents, 0), payments });
}));

router.post('/payments', wrap(async (req, res) => {
  const payment = await prisma.groupPayment.create({ data: {
    athleteId: id(req.body.athleteId, 'Спортсмен'),
    paymentDate: dateOnly(req.body.paymentDate),
    amountCents: positiveCents(req.body.amountCents),
    comment: optionalText(req.body.comment)
  }, include: { athlete: { select: { fullName: true } } } });
  await audit(req, 'GROUP_PAYMENT_CREATED', 'GroupPayment', payment.id, { amountCents: payment.amountCents });
  res.status(201).json({ payment });
}));

router.delete('/payments/:paymentId', wrap(async (req, res) => {
  const paymentId = id(req.params.paymentId);
  const payment = await prisma.groupPayment.delete({ where: { id: paymentId } });
  await audit(req, 'GROUP_PAYMENT_DELETED', 'GroupPayment', paymentId, { amountCents: payment.amountCents });
  res.status(204).end();
}));

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
  const training = await prisma.personalTraining.update({ where: { id: trainingId }, data: {
    startsAt: req.body.startsAt ? date(req.body.startsAt) : existing.startsAt,
    priceCents: req.body.priceCents ? positiveCents(req.body.priceCents) : existing.priceCents,
    status: choice(req.body.status || existing.status, ['SCHEDULED', 'COMPLETED', 'CANCELLED'], 'Статус'),
    comment: req.body.comment === undefined ? existing.comment : optionalText(req.body.comment, 3000),
    reminderMinutes: req.body.reminderMinutes === undefined ? existing.reminderMinutes : (req.body.reminderMinutes === null ? null : Number(req.body.reminderMinutes))
  } });
  await audit(req, 'PERSONAL_TRAINING_UPDATED', 'PersonalTraining', training.id, { status: training.status });
  return res.json({ training });
}));

router.get('/calendar', wrap(async (req, res) => {
  const from = req.query.from ? dateOnly(req.query.from) : new Date();
  const to = req.query.to ? new Date(dateOnly(req.query.to).getTime() + 86400000) : new Date(Date.now() + 31 * 86400000);
  const [groupTrainings, personalTrainings] = await Promise.all([
    prisma.groupTraining.findMany({ where: { trainingDate: { gte: from, lt: to } }, include: { group: { select: { name: true } } }, orderBy: [{ trainingDate: 'asc' }, { startTime: 'asc' }] }),
    prisma.personalTraining.findMany({ where: { ownerId: req.session.user.id, startsAt: { gte: from, lt: to }, status: { not: 'CANCELLED' } }, include: { client: { select: { name: true } } }, orderBy: { startsAt: 'asc' } })
  ]);
  res.json({ groupTrainings, personalTrainings });
}));

router.get('/tasks', wrap(async (req, res) => {
  const completed = req.query.completed === 'true';
  const tasks = await prisma.clubTask.findMany({ where: { completed }, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }] });
  res.json({ tasks });
}));

router.post('/tasks', wrap(async (req, res) => {
  const task = await prisma.clubTask.create({ data: {
    title: requiredText(req.body.title, 'Название', 240),
    dueAt: req.body.dueAt ? date(req.body.dueAt) : null,
    comment: optionalText(req.body.comment, 2000),
    priority: choice(req.body.priority || 'NORMAL', ['NORMAL', 'IMPORTANT'], 'Приоритет'),
    reminderAt: req.body.reminderAt ? date(req.body.reminderAt) : null
  } });
  await audit(req, 'TASK_CREATED', 'ClubTask', task.id);
  res.status(201).json({ task });
}));

router.put('/tasks/:taskId', wrap(async (req, res) => {
  const taskId = id(req.params.taskId);
  const existing = await prisma.clubTask.findUnique({ where: { id: taskId } });
  if (!existing) return res.status(404).json({ error: 'Задача не найдена' });
  const completed = req.body.completed === undefined ? existing.completed : Boolean(req.body.completed);
  const task = await prisma.clubTask.update({ where: { id: taskId }, data: {
    title: req.body.title === undefined ? existing.title : requiredText(req.body.title, 'Название', 240),
    dueAt: req.body.dueAt === undefined ? existing.dueAt : (req.body.dueAt ? date(req.body.dueAt) : null),
    comment: req.body.comment === undefined ? existing.comment : optionalText(req.body.comment, 2000),
    priority: req.body.priority === undefined ? existing.priority : choice(req.body.priority, ['NORMAL', 'IMPORTANT'], 'Приоритет'),
    completed,
    completedAt: completed ? (existing.completedAt || new Date()) : null,
    reminderAt: req.body.reminderAt === undefined ? existing.reminderAt : (req.body.reminderAt ? date(req.body.reminderAt) : null)
  } });
  await audit(req, completed ? 'TASK_COMPLETED' : 'TASK_UPDATED', 'ClubTask', task.id);
  return res.json({ task });
}));

router.delete('/tasks/:taskId', wrap(async (req, res) => {
  const taskId = id(req.params.taskId);
  await prisma.clubTask.delete({ where: { id: taskId } });
  await audit(req, 'TASK_DELETED', 'ClubTask', taskId);
  res.status(204).end();
}));

router.get('/expense-categories', wrap(async (_req, res) => {
  const categories = await prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
  res.json({ categories });
}));

router.post('/expense-categories', wrap(async (req, res) => {
  const category = await prisma.expenseCategory.create({ data: { name: requiredText(req.body.name, 'Категория', 100).toLowerCase() } });
  await audit(req, 'EXPENSE_CATEGORY_CREATED', 'ExpenseCategory', category.id);
  res.status(201).json({ category });
}));

router.get('/expenses', wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  const expenses = await prisma.expense.findMany({ where: { expenseDate: { gte: range.start, lt: range.end } }, include: { category: true }, orderBy: { expenseDate: 'desc' } });
  res.json({ month: range.month, totalCents: expenses.reduce((sum, item) => sum + item.amountCents, 0), expenses });
}));

router.post('/expenses', wrap(async (req, res) => {
  const expense = await prisma.expense.create({ data: {
    title: requiredText(req.body.title, 'Название', 240),
    expenseDate: dateOnly(req.body.expenseDate),
    amountCents: positiveCents(req.body.amountCents),
    categoryId: id(req.body.categoryId, 'Категория'),
    comment: optionalText(req.body.comment, 2000)
  }, include: { category: true } });
  await audit(req, 'EXPENSE_CREATED', 'Expense', expense.id, { amountCents: expense.amountCents });
  res.status(201).json({ expense });
}));

router.put('/expenses/:expenseId', wrap(async (req, res) => {
  const expenseId = id(req.params.expenseId);
  const expense = await prisma.expense.update({ where: { id: expenseId }, data: {
    title: requiredText(req.body.title, 'Название', 240),
    expenseDate: dateOnly(req.body.expenseDate),
    amountCents: positiveCents(req.body.amountCents),
    categoryId: id(req.body.categoryId, 'Категория'),
    comment: optionalText(req.body.comment, 2000)
  }, include: { category: true } });
  await audit(req, 'EXPENSE_UPDATED', 'Expense', expense.id);
  res.json({ expense });
}));

router.delete('/expenses/:expenseId', wrap(async (req, res) => {
  const expenseId = id(req.params.expenseId);
  const expense = await prisma.expense.delete({ where: { id: expenseId } });
  await audit(req, 'EXPENSE_DELETED', 'Expense', expenseId, { amountCents: expense.amountCents });
  res.status(204).end();
}));

router.get('/statistics', wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  const [payments, expenses, trainingCount, presentCount] = await Promise.all([
    prisma.groupPayment.aggregate({ where: { paymentDate: { gte: range.start, lt: range.end } }, _sum: { amountCents: true } }),
    prisma.expense.aggregate({ where: { expenseDate: { gte: range.start, lt: range.end } }, _sum: { amountCents: true } }),
    prisma.groupTraining.count({ where: { trainingDate: { gte: range.start, lt: range.end } } }),
    prisma.attendance.count({ where: { present: true, training: { trainingDate: { gte: range.start, lt: range.end } } } })
  ]);
  const income = payments._sum.amountCents || 0;
  const spending = expenses._sum.amountCents || 0;
  res.json({ month: range.month, incomeCents: income, expenseCents: spending, differenceCents: income - spending, groupTrainingCount: trainingCount, attendanceCount: presentCount });
}));

router.get('/owners', wrap(async (_req, res) => {
  const owners = await prisma.user.findMany({ where: { active: true, role: 'OWNER' }, select: { id: true, name: true } });
  res.json({ owners });
}));

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
  const telegram = await prisma.appSetting.findUnique({ where: { key: 'PUBLIC_TELEGRAM_URL' } });
  res.json({ telegramUrl: telegram?.value || process.env.PUBLIC_TELEGRAM_URL || 'https://t.me/baikalov_art_trener', pushConfigured: pushConfigured() });
}));

router.put('/settings', wrap(async (req, res) => {
  const telegramUrl = requiredText(req.body.telegramUrl, 'Telegram-ссылка', 500);
  if (!/^https:\/\/t\.me\/[A-Za-z0-9_+/-]+$/.test(telegramUrl)) return res.status(400).json({ error: 'Укажите корректную ссылку https://t.me/…' });
  await prisma.appSetting.upsert({ where: { key: 'PUBLIC_TELEGRAM_URL' }, create: { key: 'PUBLIC_TELEGRAM_URL', value: telegramUrl }, update: { value: telegramUrl } });
  await audit(req, 'SETTING_UPDATED', 'AppSetting', 'PUBLIC_TELEGRAM_URL');
  res.json({ telegramUrl });
}));

router.get('/audit-log', wrap(async (_req, res) => {
  const entries = await prisma.auditLog.findMany({ include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ entries });
}));

module.exports = router;
