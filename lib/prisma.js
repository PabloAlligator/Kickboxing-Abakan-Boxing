const { PrismaClient } = require('@prisma/client');

const prisma = global.__sodruzhestvoPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__sodruzhestvoPrisma = prisma;
}

module.exports = prisma;
