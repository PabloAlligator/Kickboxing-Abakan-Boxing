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

router.get('/owners', wrap(async (_req, res) => {
  const owners = await prisma.user.findMany({ where: { active: true, role: 'OWNER' }, select: { id: true, name: true } });
  res.json({ owners });
}));

module.exports = router;
