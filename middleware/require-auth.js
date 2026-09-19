function api(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Сессия истекла. Войдите снова.' });
  }
  return next();
}

function page(req, res, next) {
  if (!req.session?.user?.id) {
    return res.redirect(303, '/admin/login');
  }
  return next();
}

module.exports = { api, page };
