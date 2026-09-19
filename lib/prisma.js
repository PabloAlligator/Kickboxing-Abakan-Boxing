const { PrismaClient } = require('@prisma/client');

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const isTest = process.env.NODE_ENV === 'test';

if (isTest && databaseUrl !== 'file:./test.db') {
  throw new Error(
    'ОПАСНЫЙ ЗАПУСК ОСТАНОВЛЕН: NODE_ENV=test разрешён только с DATABASE_URL=file:./test.db',
  );
}

if (!isTest && databaseUrl === 'file:./test.db') {
  throw new Error(
    'ОПАСНЫЙ ЗАПУСК ОСТАНОВЛЕН: рабочий сервер не может использовать prisma/test.db',
  );
}

const prisma = global.__sodruzhestvoPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__sodruzhestvoPrisma = prisma;
}

module.exports = prisma;
