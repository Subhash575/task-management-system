import { Readable } from 'node:stream';
import { StorageObjectMissingError } from './errors.js';

/** Keeps objects in RAM. Only for automated tests; everything is lost when the process ends. */
export function createMemoryStorage() {
  const objects = new Map();

  return {
    objects, // exposed so tests can check what is (not) stored
    async put(key, buffer, { contentType }) {
      objects.set(key, { buffer: Buffer.from(buffer), contentType });
    },
    async getStream(key) {
      const object = objects.get(key);
      if (!object) throw new StorageObjectMissingError(key);
      return Readable.from([object.buffer]);
    },
    async remove(key) {
      objects.delete(key);
    },
  };
}
