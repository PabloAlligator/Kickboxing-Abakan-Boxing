require('dotenv').config();

const path = require('node:path');
const prisma = require('../lib/prisma');

function resolveSqlitePath(databaseUrl) {
  const raw = String(databaseUrl || '');
  if (!raw.startsWith('file:')) return raw || '(DATABASE_URL не задан)';
  return path.resolve(__dirname, '..', 'prisma', raw.slice(5));
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, login: true, role: true, active: true },
    orderBy: { id: 'asc' },
  });
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log(`SQLite: ${resolveSqlitePath(process.env.DATABASE_URL)}`);
  console.log(`Владельцев: ${users.length}`);
  if (users.length) console.table(users);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
