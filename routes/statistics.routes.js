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

module.exports = router;
