import { User } from '../models/User.js';

/** Makes user text safe to use inside a regular expression, so "a.b" or "(" are matched literally. */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Registered users for the assignee picker. Only id, name and email are ever selected and returned,
 * so nothing else on the user document (password hash, timestamps) can leak.
 */
export async function listUsers({ search, limit }) {
  const filter = {};
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const users = await User.find(filter).select('name email').collation({ locale: 'en' }).sort({ name: 1, _id: 1 }).limit(limit);

  return users.map((user) => ({ id: user.id, name: user.name, email: user.email }));
}
