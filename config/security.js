const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SESSION_COOKIE_NAME = IS_PRODUCTION
  ? '__Host-sodruzhestvo_admin_session'
  : 'sodruzhestvo_admin_session';

const DEFAULT_SESSION_DAYS = 7;

function getSessionCookieOptions() {
  const days = Math.max(1, Number(process.env.SESSION_DAYS || DEFAULT_SESSION_DAYS));
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
    maxAge: days * 24 * 60 * 60 * 1000,
  };
}

function getSessionCookieClearOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
  };
}

module.exports = {
  IS_PRODUCTION,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getSessionCookieClearOptions,
};
