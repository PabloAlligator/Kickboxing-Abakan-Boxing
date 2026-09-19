require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl.startsWith('file:')) process.exit(0);

const rawPath = databaseUrl.slice('file:'.length).split('?')[0];
if (!rawPath) process.exit(0);

const prismaDir = path.join(__dirname, '..', 'prisma');
const databasePath = path.isAbsolute(rawPath) ? rawPath : path.join(prismaDir, rawPath);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.closeSync(fs.openSync(databasePath, 'a'));
