const session = require('express-session');
const prisma = require('../lib/prisma');

class PrismaSessionStore extends session.Store {
  get(sid, callback) {
    prisma.session.findUnique({ where: { sid } })
      .then(async (record) => {
        if (!record || record.expiresAt <= new Date()) {
          if (record) await prisma.session.delete({ where: { sid } }).catch(() => {});
          return callback(null, null);
        }
        return callback(null, JSON.parse(record.data));
      })
      .catch(callback);
  }

  set(sid, value, callback = () => {}) {
    const expiresAt = value.cookie?.expires ? new Date(value.cookie.expires) : new Date(Date.now() + 12 * 60 * 60 * 1000);
    prisma.session.upsert({
      where: { sid },
      create: { sid, data: JSON.stringify(value), expiresAt },
      update: { data: JSON.stringify(value), expiresAt }
    }).then(() => callback()).catch(callback);
  }

  destroy(sid, callback = () => {}) {
    prisma.session.deleteMany({ where: { sid } }).then(() => callback()).catch(callback);
  }

  touch(sid, value, callback = () => {}) {
    const expiresAt = value.cookie?.expires ? new Date(value.cookie.expires) : new Date(Date.now() + 12 * 60 * 60 * 1000);
    prisma.session.updateMany({ where: { sid }, data: { expiresAt } }).then(() => callback()).catch(callback);
  }

  clearExpired() {
    return prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}

module.exports = PrismaSessionStore;
