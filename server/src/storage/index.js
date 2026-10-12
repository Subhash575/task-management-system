import { env } from '../config/env.js';
import { createLocalStorage } from './local.js';
import { createMemoryStorage } from './memory.js';
import { createS3Storage } from './s3.js';

let storage;

/**
 * The configured storage driver, created on first use. Every driver offers the same three calls:
 *   put(key, buffer, { contentType })   getStream(key)   remove(key)
 * Credentials stay inside the driver and are never returned to callers.
 */
export function getStorage() {
  if (!storage) {
    if (env.STORAGE_DRIVER === 's3') {
      storage = createS3Storage({
        bucket: env.S3_BUCKET,
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      });
    } else if (env.STORAGE_DRIVER === 'memory') {
      storage = createMemoryStorage();
    } else {
      storage = createLocalStorage(env.UPLOAD_DIR);
    }
  }
  return storage;
}
