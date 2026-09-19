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

module.exports = router;
