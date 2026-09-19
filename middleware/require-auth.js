const prisma = require('../lib/prisma');
const { destroySession } = require('../services/session.service');

async function getActiveOwner(req) {
  const userId = Number(req.session?.user?.id);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  return prisma.user.findFirst({
    where: {
      id: userId,
      active: true,
      role: 'OWNER',
    },
    select: {
      id: true,
      name: true,
      login: true,
      role: true,
    },
  });
}

async function invalidateSession(req) {
  if (!req.session) return;
  try {
    await destroySession(req);
  } catch {
    // Даже если хранилище сессий временно недоступно,
    // запрос всё равно не должен получить доступ к Control.
  }
}

async function api(req, res, next) {
  try {
    const user = await getActiveOwner(req);
    if (!user) {
      await invalidateSession(req);
      return res.status(401).json({ error: 'Сессия истекла. Войдите снова.' });
    }

    // Обновляем данные в сессии из БД, чтобы имя/логин не были устаревшими.
    req.session.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function page(req, res, next) {
  try {
    const user = await getActiveOwner(req);
    if (!user) {
      await invalidateSession(req);
      return res.redirect(303, '/admin/login');
    }

    req.session.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { api, page };
