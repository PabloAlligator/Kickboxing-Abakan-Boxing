require('dotenv').config();

const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { Writable } = require('node:stream');
const argon2 = require('argon2');
const prisma = require('../lib/prisma');

function validLogin(value) {
  return /^[a-z0-9._-]{3,64}$/i.test(value);
}

async function main() {
  let muted = false;
  const protectedOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) stdout.write(chunk, encoding);
      callback();
    },
  });
  const terminal = readline.createInterface({ input: stdin, output: protectedOutput, terminal: true });

  try {
    const name = (await terminal.question('Имя владельца: ')).trim();
    const login = (await terminal.question('Логин (3–64 символа): ')).trim().toLowerCase();
    stdout.write('Пароль (минимум 12 символов): ');
    muted = true;
    const password = await terminal.question('');
    muted = false;
    stdout.write('\n');

    if (!name) throw new Error('Имя обязательно');
    if (!validLogin(login)) throw new Error('Логин: латиница, цифры, точка, дефис или подчёркивание; 3–64 символа');
    if (password.length < 12 || password.length > 128) {
      throw new Error('Пароль должен содержать от 12 до 128 символов');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const owner = await prisma.user.upsert({
      where: { login },
      update: { name, passwordHash, role: 'OWNER', active: true },
      create: { name, login, passwordHash, role: 'OWNER', active: true },
    });
    await prisma.session.deleteMany({ where: { data: { contains: `"id":${owner.id}` } } });
    stdout.write(`Готово: владелец ${owner.name} (${owner.login}), id=${owner.id}, создан/обновлён.\n`);
  } finally {
    muted = false;
    terminal.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
