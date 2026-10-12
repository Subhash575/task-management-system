import { authenticateUser, registerUser } from '../services/auth.service.js';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie.js';
import { signAccessToken } from '../utils/jwt.js';

// The token only travels in the HTTP-only cookie, never in the JSON body.
function startSession(res, user) {
  setAuthCookie(res, signAccessToken(user.id));
}

export async function register(req, res) {
  const { name, email, password } = req.validated.body;
  const user = await registerUser({ name, email, password });

  startSession(res, user);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const user = await authenticateUser(req.validated.body);

  startSession(res, user);
  res.status(200).json({ user });
}

export function logout(_req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

export function getCurrentUser(req, res) {
  res.status(200).json({ user: req.user });
}
