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

const CLUB_TIMEZONE = process.env.CLUB_TIMEZONE || 'Asia/Krasnoyarsk';

function zonedParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function zonedMidnightUtc(year, month, day) {
  let guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let index = 0; index < 2; index += 1) {
    const parts = zonedParts(new Date(guess));
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    guess -= represented - Date.UTC(year, month - 1, day, 0, 0, 0);
  }
  return new Date(guess);
}

function todayKey() {
  const { year, month, day } = zonedParts();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayRange() {
  const { year, month, day } = zonedParts();
  const start = zonedMidnightUtc(year, month, day);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = zonedMidnightUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  return { start, end };
}

function monthRange(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  const now = zonedParts();
  const year = match ? Number(match[1]) : now.year;
  const monthNumber = match ? Number(match[2]) : now.month;
  if (monthNumber < 1 || monthNumber > 12) throw badRequest('Месяц: некорректное значение');

  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    month: `${year}-${String(monthNumber).padStart(2, '0')}`,
    start: zonedMidnightUtc(year, monthNumber, 1),
    end: zonedMidnightUtc(nextYear, nextMonth, 1)
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
  time,
  todayKey,
  todayRange
};
