import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

// Each +1 doubles the hashing time. 12 is a common balance between security and latency.
const BCRYPT_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

// A hash of a random value, created once on first use. Comparing against it when an email
// is unknown makes "no such user" take as long as "wrong password", so response timing
// does not reveal which emails are registered.
let dummyHashPromise;
export function verifyAgainstDummyHash(password) {
  dummyHashPromise ??= bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);
  return dummyHashPromise.then((dummyHash) => bcrypt.compare(password, dummyHash));
}
