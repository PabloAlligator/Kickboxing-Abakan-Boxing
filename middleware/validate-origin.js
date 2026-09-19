module.exports = function validateOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.get('origin');
  const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();
  const expected = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;

  if (origin && origin !== expected) {
    return res.status(403).json({ error: 'Запрос с другого источника запрещён' });
  }

  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    return res.status(403).json({ error: 'Запрос с другого источника запрещён' });
  }

  return next();
};
