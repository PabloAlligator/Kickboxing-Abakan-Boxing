const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('argon2');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-more-than-sixty-four-characters-for-sodruzhestvo';
process.env.APP_ORIGIN = 'http://localhost';

const prisma = require('../lib/prisma');
const { createApp } = require('../server');
const app = createApp();

const passwords = { artem: 'Artem-Test-Password-2026', vsevolod: 'Vsevolod-Test-Password-2026' };
let artem;
let vsevolod;
let artemAgent;
let vsevolodAgent;
let artemCsrf;
let vsevolodCsrf;

async function api(agent, csrf, method, url, body) {
  const call = agent[method](url).set('Origin', 'http://localhost');
  if (csrf) call.set('x-csrf-token', csrf);
  if (body !== undefined) call.send(body);
  return call;
}

test.before(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.groupPayment.deleteMany();
  await prisma.groupTraining.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.groupCoach.deleteMany();
  await prisma.trainingGroup.deleteMany();
  await prisma.personalTraining.deleteMany();
  await prisma.personalClient.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.clubTask.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();

  [artem, vsevolod] = await Promise.all([
    prisma.user.create({ data: { name: 'Артём Байкалов', email: 'artem@test.local', passwordHash: await argon2.hash(passwords.artem), role: 'OWNER' } }),
    prisma.user.create({ data: { name: 'Всеволод Харюшин', email: 'vsevolod@test.local', passwordHash: await argon2.hash(passwords.vsevolod), role: 'OWNER' } })
  ]);
  await prisma.expenseCategory.create({ data: { name: 'аренда' } });

  artemAgent = request.agent(app);
  vsevolodAgent = request.agent(app);
  const artemLogin = await api(artemAgent, null, 'post', '/api/auth/login', { email: artem.email, password: passwords.artem });
  const vsevolodLogin = await api(vsevolodAgent, null, 'post', '/api/auth/login', { email: vsevolod.email, password: passwords.vsevolod });
  assert.equal(artemLogin.status, 200);
  assert.equal(vsevolodLogin.status, 200);
  artemCsrf = artemLogin.body.csrfToken;
  vsevolodCsrf = vsevolodLogin.body.csrfToken;
});

test.after(async () => prisma.$disconnect());

test('базовые клубные сценарии и формула общих финансов работают', async () => {
  const groupResponse = await api(artemAgent, artemCsrf, 'post', '/api/control/groups', {
    name: 'Детская группа', days: [1, 3, 5], startTime: '17:30', coachIds: [artem.id, vsevolod.id], showPublic: true
  });
  assert.equal(groupResponse.status, 201);

  const athleteResponse = await api(artemAgent, artemCsrf, 'post', '/api/control/athletes', {
    fullName: 'Иванов Иван', groupId: groupResponse.body.group.id, expectedPaymentCents: 400000
  });
  assert.equal(athleteResponse.status, 201);
  const athleteId = athleteResponse.body.athlete.id;

  const trainingResponse = await api(artemAgent, artemCsrf, 'post', '/api/control/trainings', {
    groupId: groupResponse.body.group.id, trainingDate: '2026-09-18'
  });
  assert.equal(trainingResponse.status, 201);
  const attendance = await api(artemAgent, artemCsrf, 'put', `/api/control/trainings/${trainingResponse.body.training.id}/attendance`, {
    attendance: [{ athleteId, present: true }]
  });
  assert.equal(attendance.status, 200);

  for (const amountCents of [300000, 100000]) {
    const payment = await api(artemAgent, artemCsrf, 'post', '/api/control/payments', { athleteId, paymentDate: '2026-09-15', amountCents });
    assert.equal(payment.status, 201);
  }
  const category = await prisma.expenseCategory.findUnique({ where: { name: 'аренда' } });
  const expense = await api(vsevolodAgent, vsevolodCsrf, 'post', '/api/control/expenses', { title: 'Аренда зала', expenseDate: '2026-09-10', amountCents: 150000, categoryId: category.id });
  assert.equal(expense.status, 201);

  const stats = await api(artemAgent, artemCsrf, 'get', '/api/control/statistics?month=2026-09');
  assert.equal(stats.body.incomeCents, 400000);
  assert.equal(stats.body.expenseCents, 150000);
  assert.equal(stats.body.differenceCents, 250000);
  assert.equal(stats.body.attendanceCount, 1);

  const archived = await api(artemAgent, artemCsrf, 'patch', `/api/control/athletes/${athleteId}/status`, { status: 'ARCHIVED' });
  assert.equal(archived.body.athlete.status, 'ARCHIVED');
});

test('задачи общие и возвращаются из выполненных', async () => {
  const created = await api(artemAgent, artemCsrf, 'post', '/api/control/tasks', { title: 'Поменять лампы', priority: 'IMPORTANT' });
  assert.equal(created.status, 201);
  const completed = await api(vsevolodAgent, vsevolodCsrf, 'put', `/api/control/tasks/${created.body.task.id}`, { completed: true });
  assert.equal(completed.body.task.completed, true);
  const restored = await api(artemAgent, artemCsrf, 'put', `/api/control/tasks/${created.body.task.id}`, { completed: false });
  assert.equal(restored.body.task.completed, false);
});

test('персоналки изолированы по ownerId и не попадают в общие финансы', async () => {
  const artemClient = await api(artemAgent, artemCsrf, 'post', '/api/control/personal/clients', { name: 'Клиент Артёма' });
  const vsevolodClient = await api(vsevolodAgent, vsevolodCsrf, 'post', '/api/control/personal/clients', { name: 'Клиент Всеволода' });
  assert.equal(artemClient.status, 201);
  assert.equal(vsevolodClient.status, 201);

  const completed = await api(artemAgent, artemCsrf, 'post', '/api/control/personal/trainings', {
    clientId: artemClient.body.client.id, startsAt: '2026-09-20T11:00:00.000Z', priceCents: 200000, status: 'COMPLETED'
  });
  const scheduled = await api(artemAgent, artemCsrf, 'post', '/api/control/personal/trainings', {
    clientId: artemClient.body.client.id, startsAt: '2026-09-22T11:00:00.000Z', priceCents: 500000, status: 'SCHEDULED'
  });
  const cancelled = await api(artemAgent, artemCsrf, 'post', '/api/control/personal/trainings', {
    clientId: artemClient.body.client.id, startsAt: '2026-09-23T11:00:00.000Z', priceCents: 700000, status: 'CANCELLED'
  });
  assert.equal(completed.status, 201);
  assert.equal(scheduled.status, 201);
  assert.equal(cancelled.status, 201);

  const artemList = await api(artemAgent, artemCsrf, 'get', '/api/control/personal/trainings?month=2026-09');
  assert.equal(artemList.body.stats.incomeCents, 200000);
  assert.equal(artemList.body.trainings.length, 3);

  const foreignTraining = await api(vsevolodAgent, vsevolodCsrf, 'get', `/api/control/personal/trainings/${completed.body.training.id}`);
  const foreignClient = await api(vsevolodAgent, vsevolodCsrf, 'get', `/api/control/personal/clients/${artemClient.body.client.id}`);
  assert.equal(foreignTraining.status, 404);
  assert.equal(foreignClient.status, 404);

  const injectedOwner = await api(vsevolodAgent, vsevolodCsrf, 'post', '/api/control/personal/trainings', {
    ownerId: artem.id,
    clientId: vsevolodClient.body.client.id,
    startsAt: '2026-09-24T11:00:00.000Z',
    priceCents: 300000,
    status: 'COMPLETED'
  });
  assert.equal(injectedOwner.status, 201);
  assert.equal(injectedOwner.body.training.ownerId, vsevolod.id);

  const commonStats = await api(artemAgent, artemCsrf, 'get', '/api/control/statistics?month=2026-09');
  assert.equal(commonStats.body.incomeCents, 400000, 'персональные доходы не должны менять общую статистику');
});

test('CSRF и origin-защита отклоняют поддельные запросы, logout завершает сессию', async () => {
  const withoutCsrf = await artemAgent.post('/api/control/tasks').set('Origin', 'http://localhost').send({ title: 'Поддельная задача' });
  assert.equal(withoutCsrf.status, 403);
  const wrongOrigin = await artemAgent.post('/api/control/tasks').set('Origin', 'https://evil.example').set('x-csrf-token', artemCsrf).send({ title: 'Поддельная задача' });
  assert.equal(wrongOrigin.status, 403);
  const logout = await api(artemAgent, artemCsrf, 'post', '/api/auth/logout');
  assert.equal(logout.status, 204);
  const afterLogout = await artemAgent.get('/api/control/tasks');
  assert.equal(afterLogout.status, 401);
});
