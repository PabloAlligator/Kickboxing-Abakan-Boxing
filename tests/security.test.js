const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const testDatabaseUrl = String(process.env.DATABASE_URL || '');
if (testDatabaseUrl !== 'file:./test.db') {
  throw new Error(
    'ОПАСНЫЙ ЗАПУСК ОСТАНОВЛЕН: тесты разрешены только на prisma/test.db. Используйте npm test.',
  );
}

const argon2 = require('argon2');
const request = require('supertest');
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
  await prisma.user.deleteMany();

  [artem, vsevolod] = await Promise.all([
    prisma.user.create({ data: { name: 'TEST OWNER A', login: '__test_owner_a__', passwordHash: await argon2.hash(passwords.artem), role: 'OWNER' } }),
    prisma.user.create({ data: { name: 'TEST OWNER B', login: '__test_owner_b__', passwordHash: await argon2.hash(passwords.vsevolod), role: 'OWNER' } })
  ]);
  await prisma.expenseCategory.create({ data: { name: 'аренда' } });

  artemAgent = request.agent(app);
  vsevolodAgent = request.agent(app);
  const artemLogin = await api(artemAgent, null, 'post', '/api/admin/auth/login', { login: artem.login, password: passwords.artem });
  const vsevolodLogin = await api(vsevolodAgent, null, 'post', '/api/admin/auth/login', { login: vsevolod.login, password: passwords.vsevolod });
  assert.equal(artemLogin.status, 200);
  assert.equal(vsevolodLogin.status, 200);
  artemCsrf = artemLogin.body.csrfToken;
  vsevolodCsrf = vsevolodLogin.body.csrfToken;
});

test.after(async () => prisma.$disconnect());

test('базовые клубные сценарии и формула общих финансов работают', async () => {
  const groupResponse = await api(artemAgent, artemCsrf, 'post', '/api/admin/groups', {
    name: 'Детская группа', days: [1, 3, 5], startTime: '17:30', coachIds: [artem.id, vsevolod.id], showPublic: true
  });
  assert.equal(groupResponse.status, 201);

  const athleteResponse = await api(artemAgent, artemCsrf, 'post', '/api/admin/athletes', {
    fullName: 'Иванов Иван', groupId: groupResponse.body.group.id
  });
  assert.equal(athleteResponse.status, 201);
  const athleteId = athleteResponse.body.athlete.id;

  const trainingResponse = await api(artemAgent, artemCsrf, 'post', '/api/admin/trainings', {
    groupId: groupResponse.body.group.id, trainingDate: '2026-09-18'
  });
  assert.equal(trainingResponse.status, 201);
  const attendance = await api(artemAgent, artemCsrf, 'put', `/api/admin/trainings/${trainingResponse.body.training.id}/attendance`, {
    attendance: [{ athleteId, present: true }]
  });
  assert.equal(attendance.status, 200);

  for (const amountCents of [300000, 100000]) {
    const payment = await api(artemAgent, artemCsrf, 'post', '/api/admin/payments', { athleteId, paymentDate: '2026-09-15', amountCents });
    assert.equal(payment.status, 201);
  }
  const category = await prisma.expenseCategory.findUnique({ where: { name: 'аренда' } });
  const expense = await api(vsevolodAgent, vsevolodCsrf, 'post', '/api/admin/expenses', { title: 'Аренда зала', expenseDate: '2026-09-10', amountCents: 150000, categoryId: category.id });
  assert.equal(expense.status, 201);

  const stats = await api(artemAgent, artemCsrf, 'get', '/api/admin/statistics?month=2026-09');
  assert.equal(stats.body.incomeCents, 400000);
  assert.equal(stats.body.expenseCents, 150000);
  assert.equal(stats.body.differenceCents, 250000);
  assert.equal(stats.body.attendanceCount, 1);

  const archived = await api(artemAgent, artemCsrf, 'patch', `/api/admin/athletes/${athleteId}/status`, { status: 'ARCHIVED' });
  assert.equal(archived.body.athlete.status, 'ARCHIVED');
});

test('минимальный справочник групп работает без расписания и тренеров', async () => {
  const created = await api(artemAgent, artemCsrf, 'post', '/api/admin/groups', {
    name: 'Новички',
    startTime: '00:00',
    days: [],
    coachIds: [],
    showPublic: false,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.group.name, 'Новички');
  assert.equal(created.body.group.startTime, '00:00');
  assert.equal(created.body.group.showPublic, false);

  const groups = await api(artemAgent, artemCsrf, 'get', '/api/admin/groups');
  assert.equal(groups.status, 200);
  const group = groups.body.groups.find((item) => item.id === created.body.group.id);
  assert.ok(group);
  assert.deepEqual(group.days, []);
  assert.equal(group.coaches.length, 0);

  const renamed = await api(artemAgent, artemCsrf, 'put', `/api/admin/groups/${group.id}`, {
    name: 'Новички 2',
    startTime: group.startTime,
    days: group.days,
    coachIds: [],
    showPublic: group.showPublic,
    active: group.active,
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.group.name, 'Новички 2');
});

test('задачи общие и возвращаются из выполненных', async () => {
  const created = await api(artemAgent, artemCsrf, 'post', '/api/admin/tasks', { title: 'Поменять лампы', priority: 'IMPORTANT' });
  assert.equal(created.status, 201);
  const completed = await api(vsevolodAgent, vsevolodCsrf, 'put', `/api/admin/tasks/${created.body.task.id}`, { completed: true });
  assert.equal(completed.body.task.completed, true);
  const restored = await api(artemAgent, artemCsrf, 'put', `/api/admin/tasks/${created.body.task.id}`, { completed: false });
  assert.equal(restored.body.task.completed, false);
});

test('персоналки изолированы по ownerId и не попадают в общие финансы', async () => {
  const artemClient = await api(artemAgent, artemCsrf, 'post', '/api/admin/personal/clients', { name: 'Клиент Артёма' });
  const vsevolodClient = await api(vsevolodAgent, vsevolodCsrf, 'post', '/api/admin/personal/clients', { name: 'Клиент Всеволода' });
  assert.equal(artemClient.status, 201);
  assert.equal(vsevolodClient.status, 201);

  const completed = await api(artemAgent, artemCsrf, 'post', '/api/admin/personal/trainings', {
    clientId: artemClient.body.client.id, startsAt: '2026-09-20T11:00:00.000Z', priceCents: 200000, status: 'COMPLETED'
  });
  const scheduled = await api(artemAgent, artemCsrf, 'post', '/api/admin/personal/trainings', {
    clientId: artemClient.body.client.id, startsAt: '2026-09-22T11:00:00.000Z', priceCents: 500000, status: 'SCHEDULED'
  });
  const cancelled = await api(artemAgent, artemCsrf, 'post', '/api/admin/personal/trainings', {
    clientId: artemClient.body.client.id, startsAt: '2026-09-23T11:00:00.000Z', priceCents: 700000, status: 'CANCELLED'
  });
  assert.equal(completed.status, 201);
  assert.equal(scheduled.status, 201);
  assert.equal(cancelled.status, 201);

  const artemList = await api(artemAgent, artemCsrf, 'get', '/api/admin/personal/trainings?month=2026-09');
  assert.equal(artemList.body.stats.incomeCents, 200000);
  assert.equal(artemList.body.trainings.length, 3);

  const foreignTraining = await api(vsevolodAgent, vsevolodCsrf, 'get', `/api/admin/personal/trainings/${completed.body.training.id}`);
  const foreignClient = await api(vsevolodAgent, vsevolodCsrf, 'get', `/api/admin/personal/clients/${artemClient.body.client.id}`);
  assert.equal(foreignTraining.status, 404);
  assert.equal(foreignClient.status, 404);

  const injectedOwner = await api(vsevolodAgent, vsevolodCsrf, 'post', '/api/admin/personal/trainings', {
    ownerId: artem.id,
    clientId: vsevolodClient.body.client.id,
    startsAt: '2026-09-24T11:00:00.000Z',
    priceCents: 300000,
    status: 'COMPLETED'
  });
  assert.equal(injectedOwner.status, 201);
  assert.equal(injectedOwner.body.training.ownerId, vsevolod.id);

  const commonStats = await api(artemAgent, artemCsrf, 'get', '/api/admin/statistics?month=2026-09');
  assert.equal(commonStats.body.incomeCents, 400000, 'персональные доходы не должны менять общую статистику');
});

test('архивного спортсмена можно удалить навсегда вместе с его связанными данными', async () => {
  const group = await api(artemAgent, artemCsrf, 'post', '/api/admin/groups', {
    name: 'Группа для удаления', days: [2, 4], startTime: '19:00', coachIds: [artem.id], showPublic: false
  });
  assert.equal(group.status, 201);

  const athlete = await api(artemAgent, artemCsrf, 'post', '/api/admin/athletes', {
    fullName: 'Тест Удаление', groupId: group.body.group.id
  });
  assert.equal(athlete.status, 201);
  const athleteId = athlete.body.athlete.id;

  const payment = await api(artemAgent, artemCsrf, 'post', '/api/admin/payments', {
    athleteId, paymentDate: '2026-09-19', amountCents: 500000
  });
  assert.equal(payment.status, 201);

  const training = await api(artemAgent, artemCsrf, 'post', '/api/admin/trainings', {
    groupId: group.body.group.id, trainingDate: '2026-09-19'
  });
  assert.equal(training.status, 201);

  const attendance = await api(artemAgent, artemCsrf, 'put', `/api/admin/trainings/${training.body.training.id}/attendance`, {
    attendance: [{ athleteId, present: true }]
  });
  assert.equal(attendance.status, 200);

  const activeDelete = await api(artemAgent, artemCsrf, 'delete', `/api/admin/athletes/${athleteId}`);
  assert.equal(activeDelete.status, 409, 'активного спортсмена нельзя удалить напрямую');

  const archived = await api(artemAgent, artemCsrf, 'patch', `/api/admin/athletes/${athleteId}/status`, { status: 'ARCHIVED' });
  assert.equal(archived.status, 200);

  const deleted = await api(artemAgent, artemCsrf, 'delete', `/api/admin/athletes/${athleteId}`);
  assert.equal(deleted.status, 204);

  assert.equal(await prisma.athlete.count({ where: { id: athleteId } }), 0);
  assert.equal(await prisma.groupPayment.count({ where: { athleteId } }), 0);
  assert.equal(await prisma.attendance.count({ where: { athleteId } }), 0);
  assert.equal(await prisma.groupMembership.count({ where: { athleteId } }), 0);
});

test('удалённый владелец не может продолжать работу через старую сессию', async () => {
  const tempPassword = 'Temporary-Owner-Password-2026';
  const tempOwner = await prisma.user.create({
    data: {
      name: 'Временный владелец',
      login: 'temporary-owner',
      passwordHash: await argon2.hash(tempPassword),
      role: 'OWNER',
    },
  });

  const tempAgent = request.agent(app);
  const login = await api(tempAgent, null, 'post', '/api/admin/auth/login', {
    login: tempOwner.login,
    password: tempPassword,
  });
  assert.equal(login.status, 200);

  await prisma.auditLog.deleteMany({ where: { actorId: tempOwner.id } });
  await prisma.user.delete({ where: { id: tempOwner.id } });

  const afterDelete = await tempAgent.get('/api/admin/auth/me');
  assert.equal(afterDelete.status, 401);
});

test('CSRF и origin-защита отклоняют поддельные запросы, logout завершает сессию', async () => {
  const withoutCsrf = await artemAgent.post('/api/admin/tasks').set('Origin', 'http://localhost').send({ title: 'Поддельная задача' });
  assert.equal(withoutCsrf.status, 403);
  const wrongOrigin = await artemAgent.post('/api/admin/tasks').set('Origin', 'https://evil.example').set('x-csrf-token', artemCsrf).send({ title: 'Поддельная задача' });
  assert.equal(wrongOrigin.status, 403);
  const logout = await api(artemAgent, artemCsrf, 'post', '/api/admin/auth/logout');
  assert.equal(logout.status, 204);
  const afterLogout = await artemAgent.get('/api/admin/tasks');
  assert.equal(afterLogout.status, 401);
});
