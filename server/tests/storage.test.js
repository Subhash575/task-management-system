import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageObjectMissingError } from '../src/storage/errors.js';
import { createLocalStorage } from '../src/storage/local.js';
import { createMemoryStorage } from '../src/storage/memory.js';
import { ALLOWED_EXTENSIONS, sanitizeFilename } from '../src/utils/fileValidation.js';

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

describe.each([
  ['memory', () => createMemoryStorage()],
  ['local', (dir) => createLocalStorage(dir)],
])('%s storage driver', (_name, create) => {
  let dir;
  let storage;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'taskflow-storage-'));
    storage = create(dir);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('stores, reads back and removes an object', async () => {
    await storage.put('tasks/abc/file.txt', Buffer.from('hello'), { contentType: 'text/plain' });

    expect((await readAll(await storage.getStream('tasks/abc/file.txt'))).toString()).toBe('hello');

    await storage.remove('tasks/abc/file.txt');
    await expect(storage.getStream('tasks/abc/file.txt')).rejects.toBeInstanceOf(StorageObjectMissingError);
  });

  it('reports a missing object with a StorageObjectMissingError', async () => {
    await expect(storage.getStream('tasks/none/missing.png')).rejects.toBeInstanceOf(StorageObjectMissingError);
  });

  it('does not fail when removing an object that does not exist', async () => {
    await expect(storage.remove('tasks/none/missing.png')).resolves.toBeUndefined();
  });
});

describe('local storage safety', () => {
  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'taskflow-storage-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it.each(['../escape.txt', 'tasks/../../escape.txt', '/etc/passwd', '..\\escape.txt'])(
    'refuses a key that would leave the upload folder: %s',
    async (key) => {
      const storage = createLocalStorage(dir);

      await expect(storage.put(key, Buffer.from('x'), { contentType: 'text/plain' })).rejects.toThrow('Invalid storage key');
      expect(await readdir(dir)).toEqual([]);
    },
  );
});

describe('sanitizeFilename', () => {
  it.each([
    ['report.pdf', 'report.pdf'],
    ['../../etc/passwd.txt', 'passwd.txt'],
    ['C:\\Users\\me\\photo.png', 'photo.png'],
    ['.htaccess.txt', 'htaccess.txt'],
    ['we"ird<na>me|?.png', 'weirdname.png'],
    ['tab\tand\nnewline.txt', 'tabandnewline.txt'],
    ['', 'file'],
  ])('turns %j into %j', (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });

  it('shortens very long names but keeps the extension', () => {
    const result = sanitizeFilename(`${'a'.repeat(400)}.pdf`);

    expect(result.length).toBeLessThanOrEqual(150);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('only allows documents and images, never scriptable or executable types', () => {
    for (const dangerous of ['.svg', '.html', '.htm', '.js', '.exe', '.sh', '.php', '.zip']) {
      expect(ALLOWED_EXTENSIONS).not.toContain(dangerous);
    }
  });
});
