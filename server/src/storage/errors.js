/** Thrown by storage drivers when an object does not exist (deleted, or never written). */
export class StorageObjectMissingError extends Error {
  constructor(key) {
    super(`Storage object not found: ${key}`);
    this.name = 'StorageObjectMissingError';
  }
}
