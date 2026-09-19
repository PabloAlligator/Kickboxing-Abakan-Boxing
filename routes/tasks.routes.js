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

module.exports = router;
