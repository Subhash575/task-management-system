import { env } from '../config/env.js';

/**
 * Options shared by setting and clearing the cookie. Browsers only delete a cookie when the
 * clearing request uses the same name, path and domain, so both must come from here.
 */
function baseCookieOptions() {
  return {
    httpOnly: true, // JavaScript in the page cannot read it, which limits damage from XSS
    secure: env.isProduction, // HTTPS-only in production; plain http://localhost in dev
    sameSite: 'lax', // not sent on cross-site POSTs, a strong default against CSRF
    path: '/',
  };
}

export function setAuthCookie(res, token) {
  res.cookie(env.COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: env.JWT_EXPIRES_IN_MS, // same lifetime as the JWT itself
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(env.COOKIE_NAME, baseCookieOptions());
}

export function readAuthCookie(req) {
  return req.cookies?.[env.COOKIE_NAME];
}
