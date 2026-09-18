require('dotenv').config();

const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const owners = [
  { name: 'Артём Байкалов', email: process.env.OWNER_ARTEM_EMAIL, password: process.env.OWNER_ARTEM_PASSWORD },
  { name: 'Всеволод Харюшин', email: process.env.OWNER_VSEVOLOD_EMAIL, password: process.env.OWNER_VSEVOLOD_PASSWORD }
];

const categories = [
  'аренда',
  'коммунальные',
  'оборудование / инвентарь',
  'ремонт',
  'хозяйственные расходы',
  'реклама',
  'соревнования',
  'выплаты',
  'прочее'
];

async function main() {
  for (const owner of owners) {
    if (!owner.email || !owner.password || owner.password.length < 12) {
      throw new Error(`Для ${owner.name} задайте email и пароль длиной не менее 12 символов в .env`);
    }
    const passwordHash = await argon2.hash(owner.password, { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email: owner.email.toLowerCase() },
      create: { name: owner.name, email: owner.email.toLowerCase(), passwordHash, role: 'OWNER' },
      update: { name: owner.name, passwordHash, role: 'OWNER', active: true }
    });
  }
  for (const name of categories) {
    await prisma.expenseCategory.upsert({ where: { name }, create: { name }, update: {} });
  }
  await prisma.appSetting.upsert({
    where: { key: 'PUBLIC_TELEGRAM_URL' },
    create: { key: 'PUBLIC_TELEGRAM_URL', value: process.env.PUBLIC_TELEGRAM_URL || 'https://t.me/baikalov_art_trener' },
    update: {}
  });
  console.log('Seed завершён: два OWNER и категории расходов готовы.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
