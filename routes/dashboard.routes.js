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
  time,
  todayRange
} = require('../lib/validation');

const router = express.Router();

router.get('/dashboard', wrap(async (req, res) => {
  const range = monthRange(req.query.month);
  const { start: todayStart, end: todayEnd } = todayRange();
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

module.exports = router;
