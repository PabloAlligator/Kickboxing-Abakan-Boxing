const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const modalTitle = document.querySelector('#modal-title');
const modalBody = document.querySelector('#modal-body');
const title = document.querySelector('#page-title');
const sidebar = document.querySelector('#sidebar');
const mobileMenu = document.querySelector('#mobile-menu');
const primaryMobileRoutes = new Set(['dashboard', 'athletes', 'calendar', 'personal']);

const state = {
  user: null,
  csrf: '',
  route: 'dashboard',
  month: new Date().toISOString().slice(0, 7),
  groups: [],
  athletes: [],
  owners: [],
  categories: [],
  attendanceTrainingId: null
  ,athleteStatus: 'ACTIVE'
  ,athletePayment: ''
  ,calendarMode: 'month'
};

const pageNames = {
  dashboard: 'Главная', athletes: 'Спортсмены', groups: 'Группы', attendance: 'Посещения',
  payments: 'Оплаты', calendar: 'Календарь', personal: 'Мои персоналки', tasks: 'Задачи',
  expenses: 'Расходы', statistics: 'Статистика', settings: 'Настройки'
};

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const rubles = (cents = 0) => `${new Intl.NumberFormat('ru-RU').format(Math.round(cents / 100))} ₽`;
const shortDate = (value) => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Без срока';
const dateTime = (value) => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);
const toLocalDateTimeInput = (value) => {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const toCents = (value) => Math.round(Number(String(value).replace(',', '.')) * 100);
const empty = (titleText, text) => `<div class="empty-state"><h3>${escapeHtml(titleText)}</h3><p>${escapeHtml(text)}</p></div>`;

async function api(url, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(state.csrf ? { 'x-csrf-token': state.csrf } : {}), ...options.headers };
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
  if (response.status === 401) {
    window.location.replace('/admin/login');
    throw new Error('Сессия истекла');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие');
  return data;
}

function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  node.textContent = message;
  document.querySelector('#toasts').append(node);
  setTimeout(() => node.remove(), 4200);
}

function showModal(name, body) {
  modalTitle.textContent = name;
  modalBody.innerHTML = body;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => modalBody.querySelector('input, select, textarea')?.focus(), 0);
}

function closeModal() {
  modal.hidden = true;
  modalBody.innerHTML = '';
  document.body.style.overflow = '';
}

function setLoading() {
  app.innerHTML = '<div class="loading-state"><span class="spinner"></span><p>Загрузка данных</p></div>';
}

function monthControl() {
  return `<input class="month-input" type="month" value="${state.month}" data-action="change-month" aria-label="Выбранный месяц">`;
}

async function loadReferences(force = false) {
  if (!force && state.groups.length && state.owners.length && state.categories.length) return;
  const [groups, athletes, owners, categories] = await Promise.all([
    api('/api/admin/groups'),
    api(`/api/admin/athletes?status=ACTIVE&month=${state.month}`),
    api('/api/admin/owners'),
    api('/api/admin/expense-categories')
  ]);
  state.groups = groups.groups;
  state.athletes = athletes.athletes;
  state.owners = owners.owners;
  state.categories = categories.categories;
}

function groupOptions(selected = '') {
  return `<option value="">Выберите группу</option>${state.groups.filter((group) => group.active).map((group) => `<option value="${group.id}" ${String(selected) === String(group.id) ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}`;
}

function athleteOptions(selected = '') {
  return `<option value="">Выберите спортсмена</option>${state.athletes.map((athlete) => `<option value="${athlete.id}" ${String(selected) === String(athlete.id) ? 'selected' : ''}>${escapeHtml(athlete.fullName)}</option>`).join('')}`;
}

function categoryOptions(selected = '') {
  return state.categories.map((category) => `<option value="${category.id}" ${String(selected) === String(category.id) ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('');
}

async function renderDashboard() {
  const data = await api(`/api/admin/dashboard?month=${state.month}`);
  app.innerHTML = `
    <div class="section-head"><div><h2>Состояние клуба</h2><p>Только общая деятельность, без персоналок</p></div>${monthControl()}</div>
    <section class="stats-grid">
      ${stat('Активные спортсмены', data.athletes)}${stat('Групповые оплаты', rubles(data.income))}${stat('Расходы', rubles(data.expenses))}
      ${stat('Разница', rubles(data.difference), true)}${stat('Посещений сегодня', data.visits)}${stat('Активные задачи', data.tasks)}
    </section>
    <section class="content-grid content-grid--two">
      <div class="panel"><div class="panel-head"><h3>Сегодня</h3><a href="/admin/attendance" class="button button--secondary">Посещения</a></div>
        ${data.todayTrainings.length ? `<div class="card-list">${data.todayTrainings.map((item) => card(item.group.name, `${item.startTime} · отмечено ${item._count.attendances}`, `<a class="button button--secondary" href="/admin/attendance?trainingId=${item.id}">Открыть</a>`)).join('')}</div>` : empty('Тренировок пока нет', 'Создайте занятие в разделе «Посещения».')}
      </div>
      <div class="panel"><div class="panel-head"><h3>Последние оплаты</h3><a href="/admin/payments">Все оплаты</a></div>
        ${data.latestPayments.length ? `<div class="card-list">${data.latestPayments.map((item) => card(item.athlete.fullName, `${shortDate(item.paymentDate)} · ${rubles(item.amountCents)}`)).join('')}</div>` : empty('Нет оплат', 'Платежи появятся здесь после добавления.')}
      </div>
      <div class="panel"><div class="panel-head"><h3>Последние расходы</h3><a href="/admin/expenses">Все расходы</a></div>
        ${data.latestExpenses.length ? `<div class="card-list">${data.latestExpenses.map((item) => card(item.title, `${item.category.name} · ${rubles(item.amountCents)}`)).join('')}</div>` : empty('Нет расходов', 'Фактические расходы клуба появятся здесь.')}
      </div>
    </section>`;
}

function stat(label, value, accent = false) {
  return `<article class="stat-card${accent ? ' stat-card--accent' : ''}"><p>${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong></article>`;
}

function card(name, meta = '', actions = '', important = false) {
  return `<article class="data-card${important ? ' data-card--important' : ''}"><div class="data-card__head"><div><h4>${escapeHtml(name)}</h4>${meta ? `<p>${escapeHtml(meta)}</p>` : ''}</div></div>${actions ? `<div class="button-group">${actions}</div>` : ''}</article>`;
}

async function renderAthletes() {
  await loadReferences(true);
  const data = await api(`/api/admin/athletes?status=${state.athleteStatus}&month=${state.month}${state.athletePayment ? `&payment=${state.athletePayment}` : ''}`);
  state.athletes = data.athletes;
  app.innerHTML = `
    <div class="section-head"><div><h2>Спортсмены</h2><p>${data.athletes.length} в выбранном списке</p></div><button class="button button--primary" data-action="new-athlete">Добавить спортсмена</button></div>
    <div class="toolbar"><input type="search" placeholder="Поиск по имени" data-filter="athlete-search"><select data-filter="athlete-group"><option value="">Все группы</option>${groupOptions()}</select><select data-athlete-status><option value="ACTIVE" ${state.athleteStatus === 'ACTIVE' ? 'selected' : ''}>Активные</option><option value="ARCHIVED" ${state.athleteStatus === 'ARCHIVED' ? 'selected' : ''}>Архив</option></select><select data-athlete-payment><option value="" ${!state.athletePayment ? 'selected' : ''}>Любая оплата</option><option value="paid" ${state.athletePayment === 'paid' ? 'selected' : ''}>Оплатившие</option><option value="unpaid" ${state.athletePayment === 'unpaid' ? 'selected' : ''}>Без оплаты</option></select>${monthControl()}</div>
    <div class="card-list card-list--grid" id="athlete-list">${data.athletes.length ? data.athletes.map(athleteCard).join('') : empty('Список пуст', 'Добавьте первого спортсмена клуба.')}</div>`;
}

function athleteCard(athlete) {
  const groups = athlete.memberships.map((item) => item.group.name).join(', ') || 'Без группы';
  return `<article class="data-card" data-athlete-card data-name="${escapeHtml(athlete.fullName.toLowerCase())}" data-groups="${athlete.memberships.map((item) => item.group.id).join(',')}">
    <div class="data-card__head"><div><h3>${escapeHtml(athlete.fullName)}</h3><p>${escapeHtml(groups)}</p></div><span class="badge ${athlete.paidCents ? 'badge--green' : 'badge--amber'}">${athlete.paidCents ? `Оплачено ${rubles(athlete.paidCents)}` : 'Нет оплаты'}</span></div>
    <div class="meta-list"><span class="badge">Посещений: ${athlete._count.attendances}</span></div>
    <div class="button-group"><button class="button button--secondary" data-action="edit-athlete" data-id="${athlete.id}">Карточка</button>${athlete.status === 'ACTIVE' ? `<button class="button button--danger" data-action="archive-athlete" data-id="${athlete.id}">В архив</button>` : `<button class="button button--primary" data-action="restore-athlete" data-id="${athlete.id}">Вернуть</button>`}</div>
  </article>`;
}

function athleteForm(athlete = {}) {
  const membership = athlete.memberships?.find((item) => item.active);
  return `<form class="stack-form" data-form="athlete" data-id="${athlete.id || ''}">
    <label>ФИО<input name="fullName" required maxlength="200" value="${escapeHtml(athlete.fullName || '')}"></label>
    <div class="form-row"><label>Группа<select name="groupId">${groupOptions(membership?.groupId)}</select></label><label>Дата начала<input type="date" name="startedAt" value="${athlete.startedAt ? isoDate(new Date(athlete.startedAt)) : ''}"></label></div>
    <label>Комментарий<textarea name="comment" maxlength="2000">${escapeHtml(athlete.comment || '')}</textarea></label>
    <button class="button button--primary" type="submit">Сохранить</button></form>`;
}

async function renderGroups() {
  await loadReferences(true);
  app.innerHTML = `<div class="section-head"><div><h2>Группы</h2><p>Расписание связано с публичным сайтом</p></div><button class="button button--primary" data-action="new-group">Создать группу</button></div>
    <div class="card-list card-list--grid">${state.groups.length ? state.groups.map((group) => `<article class="data-card"><div class="data-card__head"><div><h3>${escapeHtml(group.name)}</h3><p>${escapeHtml(group.days.map(dayName).join(' / '))} · ${group.startTime}</p></div><span class="badge ${group.active ? 'badge--green' : ''}">${group.active ? 'Активна' : 'Архив'}</span></div><div class="meta-list"><span class="badge">Спортсменов: ${group.memberships.length}</span><span class="badge">${group.showPublic ? 'На сайте' : 'Скрыта'}</span></div><div class="button-group"><button class="button button--secondary" data-action="add-group-member" data-id="${group.id}">Добавить спортсмена</button><button class="button button--secondary" data-action="edit-group" data-id="${group.id}">Изменить</button></div></article>`).join('') : empty('Групп пока нет', 'Создайте первую тренировочную группу.')}</div>`;
}

function dayName(day) { return ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][day] || ''; }

function groupForm(group = {}) {
  return `<form class="stack-form" data-form="group" data-id="${group.id || ''}"><label>Название<input name="name" required maxlength="120" value="${escapeHtml(group.name || '')}"></label><label>Время<input type="time" name="startTime" required value="${group.startTime || '17:30'}"></label>
    <fieldset><legend>Дни недели</legend><div class="check-row">${[1,2,3,4,5,6,7].map((day) => `<label class="check-chip"><input type="checkbox" name="days" value="${day}" ${(group.days || []).includes(day) ? 'checked' : ''}>${dayName(day)}</label>`).join('')}</div></fieldset>
    <fieldset><legend>Тренеры</legend><div class="check-row">${state.owners.map((owner) => `<label class="check-chip"><input type="checkbox" name="coachIds" value="${owner.id}" ${group.coaches?.some((item) => item.user.id === owner.id) ? 'checked' : ''}>${escapeHtml(owner.name)}</label>`).join('')}</div></fieldset>
    <label class="check-chip"><input type="checkbox" name="showPublic" ${group.showPublic !== false ? 'checked' : ''}>Показывать на публичном сайте</label>
    ${group.id ? `<label class="check-chip"><input type="checkbox" name="active" ${group.active ? 'checked' : ''}>Активная группа</label>` : ''}
    <button class="button button--primary" type="submit">Сохранить</button></form>`;
}

async function renderAttendance() {
  await loadReferences(true);
  let details = null;
  if (state.attendanceTrainingId) details = await api(`/api/admin/trainings/${state.attendanceTrainingId}/attendance`);
  app.innerHTML = `<div class="section-head"><div><h2>Посещения</h2><p>Быстрая отметка с телефона</p></div></div>
    <section class="panel"><form class="form-row" data-form="open-attendance"><label>Группа<select name="groupId" required>${groupOptions(details?.training.group.id)}</select></label><label>Дата<input type="date" name="trainingDate" value="${details ? isoDate(new Date(details.training.trainingDate)) : isoDate()}" required></label><button class="button button--primary" type="submit">Открыть занятие</button></form></section>
    ${details ? `<section class="panel"><div class="panel-head"><div><h3>${escapeHtml(details.training.group.name)}</h3><p class="muted">${shortDate(details.training.trainingDate)} · ${details.training.startTime}</p></div><div class="button-group"><button class="button button--secondary" data-action="attendance-all">Отметить всех</button><button class="button button--secondary" data-action="attendance-none">Снять все</button></div></div><form data-form="attendance" data-id="${details.training.id}"><div class="attendance-list">${details.athletes.map((athlete) => `<label class="attendance-row"><span>${escapeHtml(athlete.fullName)}</span><input type="checkbox" name="athlete" value="${athlete.id}" ${athlete.present ? 'checked' : ''}></label>`).join('')}</div><button class="button button--primary button--wide" type="submit">Сохранить посещения</button></form></section>` : ''}`;
}

async function renderPayments() {
  await loadReferences(true);
  const data = await api(`/api/admin/payments?month=${state.month}`);
  app.innerHTML = `<div class="section-head"><div><h2>Групповые оплаты</h2><p>Фактически полученные суммы</p></div><button class="button button--primary" data-action="new-payment">Добавить оплату</button></div><section class="stats-grid">${stat('Получено за месяц', rubles(data.totalCents), true)}${stat('Транзакций', data.payments.length)}</section><div class="toolbar">${monthControl()}</div><div class="card-list">${data.payments.length ? data.payments.map((payment) => card(payment.athlete.fullName, `${shortDate(payment.paymentDate)} · ${rubles(payment.amountCents)}${payment.comment ? ` · ${payment.comment}` : ''}`, `<button class="button button--danger" data-action="delete-payment" data-id="${payment.id}">Удалить</button>`)).join('') : empty('Оплат пока нет', 'Добавьте первую фактическую оплату.')}</div>`;
}

async function renderCalendar() {
  const monthStart = `${state.month}-01`;
  const now = new Date();
  let from = monthStart;
  let toDate = new Date(`${monthStart}T00:00:00Z`); toDate.setUTCMonth(toDate.getUTCMonth() + 1); toDate.setUTCDate(0);
  if (state.calendarMode === 'today') { from = isoDate(now); toDate = now; }
  if (state.calendarMode === 'week') { const weekday = (now.getUTCDay() + 6) % 7; const start = new Date(now); start.setUTCDate(start.getUTCDate() - weekday); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6); from = isoDate(start); toDate = end; }
  const data = await api(`/api/admin/calendar?from=${from}&to=${isoDate(toDate)}`);
  const events = [
    ...data.groupTrainings.map((item) => ({ id: item.id, date: isoDate(new Date(item.trainingDate)), time: item.startTime, name: item.group.name, personal: false })),
    ...data.personalTrainings.map((item) => ({ id: item.id, date: isoDate(new Date(item.startsAt)), time: new Date(item.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), name: `Персональная · ${item.client.name}`, personal: true }))
  ].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const grouped = Object.groupBy ? Object.groupBy(events, (item) => item.date) : events.reduce((acc, item) => ((acc[item.date] ||= []).push(item), acc), {});
  app.innerHTML = `<div class="section-head"><div><h2>Календарь</h2><p>Общие группы и только ваши персоналки</p></div>${state.calendarMode === 'month' ? monthControl() : ''}</div><div class="toolbar"><button class="button ${state.calendarMode === 'today' ? 'button--primary' : 'button--secondary'}" data-action="calendar-mode" data-mode="today">Сегодня</button><button class="button ${state.calendarMode === 'week' ? 'button--primary' : 'button--secondary'}" data-action="calendar-mode" data-mode="week">Неделя</button><button class="button ${state.calendarMode === 'month' ? 'button--primary' : 'button--secondary'}" data-action="calendar-mode" data-mode="month">Месяц</button></div><div class="panel calendar-list">${events.length ? Object.entries(grouped).map(([day, items]) => `<div class="calendar-day"><strong>${shortDate(`${day}T12:00:00Z`)}</strong>${items.map((item) => `<button class="calendar-event${item.personal ? ' calendar-event--personal' : ''}" type="button" data-action="${item.personal ? 'view-personal-training' : 'open-group-training'}" data-id="${item.id}"><strong>${item.time}</strong><span>${escapeHtml(item.name)}</span></button>`).join('')}</div>`).join('') : empty('Событий нет', 'На выбранный период ничего не запланировано.')}</div>`;
}

async function renderPersonal() {
  const [clientsData, trainingsData] = await Promise.all([api('/api/admin/personal/clients'), api(`/api/admin/personal/trainings?month=${state.month}`)]);
  const clients = clientsData.clients;
  const trainings = trainingsData.trainings;
  app.innerHTML = `<div class="section-head"><div><h2>Мои персоналки</h2><p>Приватно: видит только ${escapeHtml(state.user.name)}</p></div><div class="button-group"><button class="button button--secondary" data-action="new-personal-client">Новый клиент</button><button class="button button--primary" data-action="new-personal-training">Новая тренировка</button></div></div>
    <section class="stats-grid">${stat('Клиентов', trainingsData.stats.clients)}${stat('Проведено', trainingsData.stats.completed)}${stat('Доход за месяц', rubles(trainingsData.stats.incomeCents), true)}${stat('Ближайших', trainingsData.stats.upcoming)}</section>
    <div class="toolbar">${monthControl()}</div><section class="content-grid content-grid--two"><div class="panel"><h3>Персональные клиенты</h3><div class="card-list">${clients.length ? clients.map((client) => card(client.name, `${client.trainings.filter((item) => item.status === 'COMPLETED').length} проведено · ${rubles(client.trainings.filter((item) => item.status === 'COMPLETED').reduce((sum, item) => sum + item.priceCents, 0))}`, `<button class="button button--secondary" data-action="view-personal-client" data-id="${client.id}">История</button>`)).join('') : empty('Клиентов пока нет', 'Создайте персональную карточку.')}</div></div>
    <div class="panel"><h3>Тренировки месяца</h3><div class="card-list">${trainings.length ? trainings.map((training) => card(training.client.name, `${dateTime(training.startsAt)} · ${rubles(training.priceCents)}`, `<span class="badge ${training.status === 'COMPLETED' ? 'badge--green' : training.status === 'CANCELLED' ? 'badge--red' : 'badge--amber'}">${statusName(training.status)}</span><button class="button button--secondary" data-action="edit-personal-training" data-id="${training.id}">Изменить</button>${training.status === 'SCHEDULED' ? `<button class="button button--secondary" data-action="complete-personal" data-id="${training.id}">Проведена</button><button class="button button--danger" data-action="cancel-personal" data-id="${training.id}">Отменена</button>` : ''}`)).join('') : empty('Тренировок нет', 'Добавьте первую персональную тренировку.')}</div></div></section>`;
}

function statusName(status) { return ({ SCHEDULED: 'Запланирована', COMPLETED: 'Проведена', CANCELLED: 'Отменена' })[status] || status; }

async function renderTasks() {
  const [active, completed] = await Promise.all([api('/api/admin/tasks'), api('/api/admin/tasks?completed=true')]);
  app.innerHTML = `<div class="section-head"><div><h2>Задачи клуба</h2><p>Общий список без ответственных</p></div><button class="button button--primary" data-action="new-task">Создать задачу</button></div><section class="content-grid content-grid--two"><div class="panel"><h3>Активные · ${active.tasks.length}</h3><div class="card-list">${active.tasks.length ? active.tasks.map((task) => card(task.title, `${task.dueAt ? shortDate(task.dueAt) : 'Без срока'}${task.comment ? ` · ${task.comment}` : ''}`, `<button class="button button--primary" data-action="complete-task" data-id="${task.id}">Выполнено</button><button class="button button--danger" data-action="delete-task" data-id="${task.id}">Удалить</button>`, task.priority === 'IMPORTANT')).join('') : empty('Всё сделано', 'Активных задач нет.')}</div></div><div class="panel"><h3>Выполненные · ${completed.tasks.length}</h3><div class="card-list">${completed.tasks.length ? completed.tasks.map((task) => card(task.title, task.completedAt ? shortDate(task.completedAt) : '', `<button class="button button--secondary" data-action="restore-task" data-id="${task.id}">Вернуть</button>`)).join('') : empty('Список пуст', 'Завершённые задачи появятся здесь.')}</div></div></section>`;
}

async function renderExpenses() {
  await loadReferences(true);
  const data = await api(`/api/admin/expenses?month=${state.month}`);
  app.innerHTML = `<div class="section-head"><div><h2>Расходы</h2><p>Простой фактический учёт клуба</p></div><div class="button-group"><button class="button button--secondary" data-action="new-category">Категория</button><button class="button button--primary" data-action="new-expense">Добавить расход</button></div></div><section class="stats-grid">${stat('Расходы за месяц', rubles(data.totalCents), true)}${stat('Операций', data.expenses.length)}</section><div class="toolbar">${monthControl()}</div><div class="card-list">${data.expenses.length ? data.expenses.map((expense) => card(expense.title, `${shortDate(expense.expenseDate)} · ${expense.category.name} · ${rubles(expense.amountCents)}${expense.comment ? ` · ${expense.comment}` : ''}`, `<button class="button button--danger" data-action="delete-expense" data-id="${expense.id}">Удалить</button>`)).join('') : empty('Расходов нет', 'На выбранный месяц расходы не добавлены.')}</div>`;
}

async function renderStatistics() {
  const data = await api(`/api/admin/statistics?month=${state.month}`);
  app.innerHTML = `<div class="section-head"><div><h2>Общая статистика</h2><p>Персональные тренировки сюда не входят</p></div>${monthControl()}</div><section class="stats-grid">${stat('Групповые оплаты', rubles(data.incomeCents))}${stat('Расходы', rubles(data.expenseCents))}${stat('Разница', rubles(data.differenceCents), true)}${stat('Групповых тренировок', data.groupTrainingCount)}${stat('Посещений', data.attendanceCount)}</section><div class="panel"><h3>Формула</h3><p class="muted">Групповые оплаты − расходы клуба = ${rubles(data.differenceCents)}. Доходы Артёма и Всеволода от персоналок остаются в их личных разделах и не участвуют в этом расчёте.</p></div>`;
}

async function renderSettings() {
  const data = await api('/api/admin/settings');
  app.innerHTML = `<div class="section-head"><div><h2>Настройки</h2><p>Уведомления панели</p></div></div><section><div class="panel"><h3>Уведомления</h3><p class="muted">${data.pushConfigured ? 'Сервер Web Push настроен. Разрешите уведомления на каждом нужном устройстве.' : 'Для отправки уведомлений добавьте VAPID-ключи в production .env.'}</p><button class="button button--secondary" data-action="enable-push">Включить на этом устройстве</button></div></section>`;
}


async function route() {
  const requested = document.body.dataset.adminPage || location.pathname.split('/').filter(Boolean).pop() || 'dashboard';
  state.route = pageNames[requested] ? requested : 'dashboard';
  title.textContent = pageNames[state.route];
  document.querySelectorAll('.admin-sidebar__link[data-route]').forEach((link) => {
    const active = link.dataset.route === state.route;
    link.classList.toggle('admin-sidebar__link--active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('.admin-bottom-nav__link[data-route]').forEach((link) => {
    const active = link.dataset.route === state.route;
    link.classList.toggle('admin-bottom-nav__link--active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  mobileMenu?.classList.toggle('admin-bottom-nav__more--active', !primaryMobileRoutes.has(state.route));
  closeSidebar();
  setLoading();
  try {
    await ({ dashboard: renderDashboard, athletes: renderAthletes, groups: renderGroups, attendance: renderAttendance, payments: renderPayments, calendar: renderCalendar, personal: renderPersonal, tasks: renderTasks, expenses: renderExpenses, statistics: renderStatistics, settings: renderSettings }[state.route])();
    app.focus({ preventScroll: true });
  } catch (error) {
    app.innerHTML = empty('Не удалось загрузить раздел', error.message);
    toast(error.message, 'error');
  }
}

document.addEventListener('click' , async (event) => {
  const actionNode = event.target.closest('[data-action]');
  if (!actionNode) return;
  const action = actionNode.dataset.action;
  try {
    if (action === 'close-sidebar') return closeSidebar();
    if (action === 'close-modal') return closeModal();
    if (action === 'logout') { await api('/api/admin/auth/logout', { method: 'POST' }); return window.location.replace('/admin/login'); }
    if (action === 'new-athlete') return showModal('Новый спортсмен', athleteForm());
    if (action === 'edit-athlete') { const { athlete } = await api(`/api/admin/athletes/${actionNode.dataset.id}`); return showModal('Карточка спортсмена', athleteForm(athlete)); }
    if (action === 'archive-athlete' && confirm('Перенести спортсмена в архив?')) { await api(`/api/admin/athletes/${actionNode.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'ARCHIVED' }) }); toast('Спортсмен архивирован'); return route(); }
    if (action === 'restore-athlete') { await api(`/api/admin/athletes/${actionNode.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) }); toast('Спортсмен возвращён'); return route(); }
    if (action === 'new-group') return showModal('Новая группа', groupForm());
    if (action === 'edit-group') { const group = state.groups.find((item) => item.id === Number(actionNode.dataset.id)); return showModal('Настройки группы', groupForm(group)); }
    if (action === 'add-group-member') return showModal('Добавить в группу', `<form class="stack-form" data-form="group-member" data-id="${actionNode.dataset.id}"><label>Спортсмен<select name="athleteId" required>${athleteOptions()}</select></label><button class="button button--primary" type="submit">Добавить</button></form>`);
    if (action === 'attendance-all' || action === 'attendance-none') { document.querySelectorAll('[data-form="attendance"] input[type="checkbox"]').forEach((input) => { input.checked = action === 'attendance-all'; }); return; }
    if (action === 'new-payment') return showModal('Добавить оплату', `<form class="stack-form" data-form="payment"><label>Спортсмен<select name="athleteId" required>${athleteOptions()}</select></label><div class="form-row"><label>Дата<input type="date" name="paymentDate" required value="${isoDate()}"></label><label>Сумма, ₽<input type="number" name="amount" min="1" step="1" required></label></div><label>Комментарий<textarea name="comment"></textarea></label><button class="button button--primary" type="submit">Сохранить оплату</button></form>`);
    if (action === 'delete-payment' && confirm('Удалить платёж? Финансовая история изменится.')) { await api(`/api/admin/payments/${actionNode.dataset.id}`, { method: 'DELETE' }); toast('Платёж удалён'); return route(); }
    if (action === 'new-personal-client') return showModal('Персональный клиент', `<form class="stack-form" data-form="personal-client"><label>Имя<input name="name" required maxlength="160"></label><label>Заметки<textarea name="notes" maxlength="3000"></textarea></label><button class="button button--primary" type="submit">Создать карточку</button></form>`);
    if (action === 'new-personal-training') { const { clients } = await api('/api/admin/personal/clients'); return showModal('Персональная тренировка', `<form class="stack-form" data-form="personal-training"><label>Клиент<select name="clientId" required><option value="">Выберите клиента</option>${clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join('')}</select></label><div class="form-row"><label>Дата и время<input type="datetime-local" name="startsAt" required></label><label>Цена, ₽<input type="number" name="price" min="1" required></label></div><label>Напоминание<select name="reminderMinutes"><option value="1440">За день</option><option value="120">За 2 часа</option><option value="">Без напоминания</option></select></label><label>Комментарий<textarea name="comment" maxlength="3000"></textarea></label><button class="button button--primary" type="submit">Запланировать</button></form>`); }
    if (action === 'view-personal-client') { const { client } = await api(`/api/admin/personal/clients/${actionNode.dataset.id}`); return showModal(client.name, `<p class="muted">${escapeHtml(client.notes || 'Без общих заметок')}</p><div class="card-list">${client.trainings.length ? client.trainings.map((item) => card(dateTime(item.startsAt), `${statusName(item.status)} · ${rubles(item.priceCents)}${item.comment ? ` · ${item.comment}` : ''}`)).join('') : empty('История пуста', 'Тренировок ещё нет.')}</div>`); }
    if (action === 'view-personal-training' || action === 'edit-personal-training') {
      const [{ training }, { clients }] = await Promise.all([
        api(`/api/admin/personal/trainings/${actionNode.dataset.id}`),
        api('/api/admin/personal/clients')
      ]);
      return showModal('Персональная тренировка', `<form class="stack-form" data-form="personal-training-edit" data-id="${training.id}">
        <label>Клиент<select name="clientId" disabled>${clients.map((client) => `<option value="${client.id}" ${client.id === training.clientId ? 'selected' : ''}>${escapeHtml(client.name)}</option>`).join('')}</select></label>
        <div class="form-row"><label>Дата и время<input type="datetime-local" name="startsAt" required value="${toLocalDateTimeInput(training.startsAt)}"></label><label>Цена, ₽<input type="number" name="price" min="1" required value="${Math.round(training.priceCents / 100)}"></label></div>
        <label>Статус<select name="status"><option value="SCHEDULED" ${training.status === 'SCHEDULED' ? 'selected' : ''}>Запланирована</option><option value="COMPLETED" ${training.status === 'COMPLETED' ? 'selected' : ''}>Проведена</option><option value="CANCELLED" ${training.status === 'CANCELLED' ? 'selected' : ''}>Отменена</option></select></label>
        <label>Напоминание<select name="reminderMinutes"><option value="1440" ${training.reminderMinutes === 1440 ? 'selected' : ''}>За день</option><option value="120" ${training.reminderMinutes === 120 ? 'selected' : ''}>За 2 часа</option><option value="" ${training.reminderMinutes == null ? 'selected' : ''}>Без напоминания</option></select></label>
        <label>Комментарий<textarea name="comment" maxlength="3000">${escapeHtml(training.comment || '')}</textarea></label>
        <button class="button button--primary" type="submit">Сохранить изменения</button>
      </form>`);
    }
    if (action === 'open-group-training') {
      window.location.href = `/admin/attendance?trainingId=${actionNode.dataset.id}`;
      return;
    }
    if (action === 'complete-personal' || action === 'cancel-personal') { await api(`/api/admin/personal/trainings/${actionNode.dataset.id}`, { method: 'PUT', body: JSON.stringify({ status: action === 'complete-personal' ? 'COMPLETED' : 'CANCELLED' }) }); toast('Статус тренировки обновлён'); return route(); }
    if (action === 'new-task') return showModal('Новая задача', `<form class="stack-form" data-form="task"><label>Название<input name="title" required maxlength="240"></label><div class="form-row"><label>Срок<input type="datetime-local" name="dueAt"></label><label>Напоминание<input type="datetime-local" name="reminderAt"></label></div><label>Приоритет<select name="priority"><option value="NORMAL">Обычный</option><option value="IMPORTANT">Важный</option></select></label><label>Комментарий<textarea name="comment"></textarea></label><button class="button button--primary" type="submit">Создать задачу</button></form>`);
    if (['complete-task', 'restore-task'].includes(action)) { await api(`/api/admin/tasks/${actionNode.dataset.id}`, { method: 'PUT', body: JSON.stringify({ completed: action === 'complete-task' }) }); toast('Задача обновлена'); return route(); }
    if (action === 'delete-task' && confirm('Удалить задачу?')) { await api(`/api/admin/tasks/${actionNode.dataset.id}`, { method: 'DELETE' }); toast('Задача удалена'); return route(); }
    if (action === 'new-category') return showModal('Новая категория', `<form class="stack-form" data-form="category"><label>Название<input name="name" required maxlength="100"></label><button class="button button--primary" type="submit">Добавить</button></form>`);
    if (action === 'new-expense') return showModal('Добавить расход', `<form class="stack-form" data-form="expense"><label>Название<input name="title" required maxlength="240"></label><div class="form-row"><label>Дата<input type="date" name="expenseDate" value="${isoDate()}" required></label><label>Сумма, ₽<input type="number" name="amount" min="1" required></label></div><label>Категория<select name="categoryId" required>${categoryOptions()}</select></label><label>Комментарий<textarea name="comment"></textarea></label><button class="button button--primary" type="submit">Сохранить расход</button></form>`);
    if (action === 'delete-expense' && confirm('Удалить расход? Общая статистика изменится.')) { await api(`/api/admin/expenses/${actionNode.dataset.id}`, { method: 'DELETE' }); toast('Расход удалён'); return route(); }
    if (action === 'enable-push') return enablePush();
    if (action === 'calendar-mode') { state.calendarMode = actionNode.dataset.mode; return renderCalendar(); }
  } catch (error) { toast(error.message, 'error'); }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const type = form.dataset.form;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    if (type === 'athlete') {
      const body = { ...values };
      await api(form.dataset.id ? `/api/admin/athletes/${form.dataset.id}` : '/api/admin/athletes', { method: form.dataset.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    } else if (type === 'group') {
      const data = new FormData(form); const body = { name: values.name, startTime: values.startTime, days: data.getAll('days').map(Number), coachIds: data.getAll('coachIds').map(Number), showPublic: data.has('showPublic'), active: form.dataset.id ? data.has('active') : true };
      await api(form.dataset.id ? `/api/admin/groups/${form.dataset.id}` : '/api/admin/groups', { method: form.dataset.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    } else if (type === 'group-member') {
      await api(`/api/admin/groups/${form.dataset.id}/members`, { method: 'POST', body: JSON.stringify(values) });
    } else if (type === 'open-attendance') {
      const trainings = await api(`/api/admin/trainings?from=${values.trainingDate}&to=${values.trainingDate}&groupId=${values.groupId}`);
      let training = trainings.trainings[0];
      if (!training) training = (await api('/api/admin/trainings', { method: 'POST', body: JSON.stringify(values) })).training;
      state.attendanceTrainingId = training.id; return renderAttendance();
    } else if (type === 'attendance') {
      const checked = new Set(new FormData(form).getAll('athlete').map(Number));
      const attendance = [...form.querySelectorAll('input[name="athlete"]')].map((input) => ({ athleteId: Number(input.value), present: checked.has(Number(input.value)) }));
      await api(`/api/admin/trainings/${form.dataset.id}/attendance`, { method: 'PUT', body: JSON.stringify({ attendance }) });
    } else if (type === 'payment') {
      await api('/api/admin/payments', { method: 'POST', body: JSON.stringify({ ...values, amountCents: toCents(values.amount) }) });
    } else if (type === 'personal-client') {
      await api('/api/admin/personal/clients', { method: 'POST', body: JSON.stringify(values) });
    } else if (type === 'personal-training') {
      await api('/api/admin/personal/trainings', { method: 'POST', body: JSON.stringify({ ...values, startsAt: new Date(values.startsAt).toISOString(), priceCents: toCents(values.price), reminderMinutes: values.reminderMinutes ? Number(values.reminderMinutes) : null }) });
    } else if (type === 'personal-training-edit') {
      await api(`/api/admin/personal/trainings/${form.dataset.id}`, { method: 'PUT', body: JSON.stringify({ startsAt: new Date(values.startsAt).toISOString(), priceCents: toCents(values.price), status: values.status, comment: values.comment, reminderMinutes: values.reminderMinutes ? Number(values.reminderMinutes) : null }) });
    } else if (type === 'task') {
      await api('/api/admin/tasks', { method: 'POST', body: JSON.stringify({ ...values, dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null, reminderAt: values.reminderAt ? new Date(values.reminderAt).toISOString() : null }) });
    } else if (type === 'category') {
      await api('/api/admin/expense-categories', { method: 'POST', body: JSON.stringify(values) });
    } else if (type === 'expense') {
      await api('/api/admin/expenses', { method: 'POST', body: JSON.stringify({ ...values, amountCents: toCents(values.amount) }) });
    }
    closeModal(); toast('Сохранено'); state.groups = []; state.categories = []; await route();
  } catch (error) { toast(error.message, 'error'); button.disabled = false; }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-action="change-month"]')) { state.month = event.target.value; route(); }
  if (event.target.matches('[data-athlete-status]')) { state.athleteStatus = event.target.value; renderAthletes(); }
  if (event.target.matches('[data-athlete-payment]')) { state.athletePayment = event.target.value; renderAthletes(); }
  if (event.target.matches('[data-filter]')) filterAthletes();
});
document.addEventListener('input', (event) => { if (event.target.matches('[data-filter]')) filterAthletes(); });

function filterAthletes() {
  const search = document.querySelector('[data-filter="athlete-search"]')?.value.toLowerCase() || '';
  const group = document.querySelector('[data-filter="athlete-group"]')?.value || '';
  document.querySelectorAll('[data-athlete-card]').forEach((cardNode) => { cardNode.hidden = !cardNode.dataset.name.includes(search) || (group && !cardNode.dataset.groups.split(',').includes(group)); });
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Этот браузер не поддерживает Web Push');
  const status = await api('/api/admin/push/status');
  if (!status.configured || !status.publicKey) throw new Error('Web Push ещё не настроен на сервере');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано');
  const registration = await navigator.serviceWorker.register('/service-worker.js');
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(status.publicKey) });
  await api('/api/admin/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) });
  toast('Уведомления включены на этом устройстве');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const raw = atob((base64String + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function openSidebar() {
  if (!sidebar) return;
  sidebar.classList.add('is-open');
  document.body.classList.add('admin-drawer-open');
  mobileMenu?.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  if (!sidebar) return;
  sidebar.classList.remove('is-open');
  document.body.classList.remove('admin-drawer-open');
  mobileMenu?.setAttribute('aria-expanded', 'false');
}

mobileMenu?.addEventListener('click', () => {
  if (sidebar?.classList.contains('is-open')) closeSidebar();
  else openSidebar();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebar?.classList.contains('is-open')) closeSidebar();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 760) closeSidebar();
});

(async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    const trainingId = Number(params.get('trainingId'));
    if (Number.isInteger(trainingId) && trainingId > 0) state.attendanceTrainingId = trainingId;

    const auth = await api('/api/admin/auth/me');
    state.user = auth.user;
    state.csrf = auth.csrfToken;
    document.querySelector('#sidebar-user').textContent = auth.user.name;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    await route();
  } catch (error) {
    if (!location.pathname.includes('/login')) window.location.replace('/admin/login');
  }
})();
