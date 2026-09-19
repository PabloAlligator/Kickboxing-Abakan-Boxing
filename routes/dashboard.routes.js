const express = require('express');
const prisma = require('../lib/prisma');
const { wrap } = require('./route-helpers');
const { monthRange } = require('../lib/validation');

const router = express.Router();

router.get('/dashboard', wrap(async (req, res) => {
  const range = monthRange(req.query.month);

  const [athletes, paidAthletes, unpaidAthletes, payments, latestPayments] = await Promise.all([
    prisma.athlete.count({ where: { status: 'ACTIVE' } }),
    prisma.athlete.count({
      where: {
        status: 'ACTIVE',
        payments: {
          some: { paymentDate: { gte: range.start, lt: range.end } },
        },
      },
    }),
    prisma.athlete.count({
      where: {
        status: 'ACTIVE',
        payments: {
          none: { paymentDate: { gte: range.start, lt: range.end } },
        },
      },
    }),
    prisma.groupPayment.aggregate({
      where: { paymentDate: { gte: range.start, lt: range.end } },
      _sum: { amountCents: true },
    }),
    prisma.groupPayment.findMany({
      where: { paymentDate: { gte: range.start, lt: range.end } },
      include: { athlete: { select: { fullName: true } } },
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      take: 5,
    }),
  ]);

  res.json({
    month: range.month,
    athletes,
    paidAthletes,
    unpaidAthletes,
    income: payments._sum.amountCents || 0,
    latestPayments,
  });
}));

module.exports = router;
