const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TEST_DB = path.join(ROOT, 'prisma', 'test.db');
const TEST_DATABASE_URL = 'file:./test.db';
const TESTS_DIR = path.join(ROOT, 'tests');

function removeTestDatabase() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(`${TEST_DB}${suffix}`, { force: true });
  }
}

function runNode(args, env) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  return result.status === 0;
}

function resolveTestFiles() {
  const requested = process.argv.slice(2);
  if (requested.length) return requested;

  return fs
    .readdirSync(TESTS_DIR)
    .filter((name) => name.endsWith('.test.js'))
    .sort()
    .map((name) => path.join('tests', name));
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  SESSION_SECRET: 'test-session-secret-with-more-than-sixty-four-characters-for-sodruzhestvo',
  APP_ORIGIN: 'http://localhost',
};

let exitCode = 0;

try {
  removeTestDatabase();

  const prismaCli = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
  if (!fs.existsSync(prismaCli)) {
    throw new Error('Prisma CLI не найден. Сначала выполните npm ci.');
  }

  if (!runNode([prismaCli, 'migrate', 'deploy'], env)) {
    exitCode = 1;
  } else {
    const testFiles = resolveTestFiles();
    if (!testFiles.length) throw new Error('Тестовые файлы не найдены.');

    if (!runNode(['--test', '--test-concurrency=1', ...testFiles], env)) {
      exitCode = 1;
    }
  }
} catch (error) {
  console.error(`Тестовый запуск остановлен: ${error.message}`);
  exitCode = 1;
} finally {
  removeTestDatabase();
}

process.exitCode = exitCode;
