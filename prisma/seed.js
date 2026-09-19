require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  for (const name of categories) {
    await prisma.expenseCategory.upsert({ where: { name }, create: { name }, update: {} });
  }
  console.log('Seed завершён: категории расходов готовы.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
