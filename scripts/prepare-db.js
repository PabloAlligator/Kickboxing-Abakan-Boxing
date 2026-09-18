require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('file:')) {
  console.error('DATABASE_URL должен быть SQLite URL формата file:../data/sodruzhestvo.db');
  process.exit(1);
}

const rawPath = databaseUrl.slice('file:'.length).split('?')[0];
const databasePath = path.isAbsolute(rawPath)
  ? rawPath
  : path.resolve(__dirname, '..', 'prisma', rawPath);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
if (!fs.existsSync(databasePath)) fs.closeSync(fs.openSync(databasePath, 'a', 0o600));
console.log(`SQLite-файл подготовлен: ${databasePath}`);
