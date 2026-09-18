const cleanText = (value, max = 500) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\0/g, '').slice(0, max);
};

const requiredText = (value, label, max = 200) => {
  const result = cleanText(value, max);
  if (!result) throw badRequest(`${label}: заполните поле`);
  return result;
};

const optionalText = (value, max = 1000) => cleanText(value, max) || null;

const positiveCents = (value, label = 'Сумма') => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > 100_000_000_00) {
    throw badRequest(`${label}: укажите корректную сумму`);
  }
  return number;
};

const id = (value, label = 'ID') => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw badRequest(`${label}: некорректное значение`);
  return number;
};

const date = (value, label = 'Дата') => {
  const result = new Date(value);
  if (!value || Number.isNaN(result.getTime())) throw badRequest(`${label}: некорректная дата`);
  return result;
};

const dateOnly = (value, label = 'Дата') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw badRequest(`${label}: некорректная дата`);
  return new Date(`${value}T12:00:00.000Z`);
};

const time = (value) => {
  const result = cleanText(value, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) throw badRequest('Время: используйте формат ЧЧ:ММ');
  return result;
};

const choice = (value, allowed, label) => {
  if (!allowed.includes(value)) throw badRequest(`${label}: недопустимое значение`);
  return value;
};

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function monthRange(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  if (monthIndex < 0 || monthIndex > 11) throw badRequest('Месяц: некорректное значение');
  return {
    month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1))
  };
}

module.exports = {
  badRequest,
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
};
