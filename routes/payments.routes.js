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

module.exports = router;
