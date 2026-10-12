import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Attachment } from '../src/models/Attachment.js';
import { getStorage } from '../src/storage/index.js';
import { useTestDatabase } from './helpers/testDb.js';

useTestDatabase();

let app;
beforeEach(() => {
  app = createApp();
});
afterEach(async () => {
  vi.restoreAllMocks();
  getStorage().objects.clear();
});

// A real 1x1 PNG, a minimal PDF header, and a few "files that lie".
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100, 1)]);
const EMPTY_ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)]);

async function signUp(name) {
  const agent = request.agent(app);
  const password = 'correct-horse-battery';
  const res = await agent
    .post('/api/auth/register')
    .send({ name, email: `${name.toLowerCase()}@example.com`, password, confirmPassword: password });
  expect(res.status).toBe(201);
  return { agent, id: res.body.user.id };
}

const createTask = (agent, body = {}) => agent.post('/api/tasks').send({ title: 'With files', ...body });
const upload = (agent, taskId, buffer = PNG, filename = 'pic.png', contentType = 'image/png') =>
  agent.post(`/api/tasks/${taskId}/attachments`).attach('file', buffer, { filename, contentType });

/** Creator Ada with a task assigned to Bob; Cy is unrelated. */
async function setup() {
  const ada = await signUp('Ada');
  const bob = await signUp('Bob');
  const cy = await signUp('Cy');
  const { body } = await createTask(ada.agent, { assignee: bob.id });
  return { ada, bob, cy, taskId: body.task.id };
}

describe('authentication', () => {
  it.each([
    ['get', ''],
    ['post', ''],
    ['get', `/${new mongoose.Types.ObjectId()}`],
    ['get', `/${new mongoose.Types.ObjectId()}/download`],
    ['delete', `/${new mongoose.Types.ObjectId()}`],
  ])('%s /attachments%s returns 401 without a session', async (method, suffix) => {
    const taskId = new mongoose.Types.ObjectId();
    const res = await request(app)[method](`/api/tasks/${taskId}/attachments${suffix}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/tasks/:id/attachments', () => {
  it('stores the file and returns only safe metadata', async () => {
    const { ada, taskId } = await setup();

    const res = await upload(ada.agent, taskId);

    expect(res.status).toBe(201);
    expect(res.body.attachment).toEqual({
      id: expect.any(String),
      filename: 'pic.png',
      mimeType: 'image/png',
      size: PNG.length,
      uploadedBy: { id: ada.id, name: 'Ada', email: 'ada@example.com' },
      createdAt: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/storageKey|tasks\//);
    expect(getStorage().objects.size).toBe(1);
  });

  it('keeps non-ASCII filenames intact', async () => {
    const { ada, taskId } = await setup();

    const res = await upload(ada.agent, taskId, PNG, 'Café — résumé.png');

    expect(res.body.attachment.filename).toBe('Café — résumé.png');
  });

  it('lets the assignee upload too, and records who uploaded', async () => {
    const { bob, taskId } = await setup();

    const res = await upload(bob.agent, taskId, PDF, 'spec.pdf', 'application/pdf');

    expect(res.status).toBe(201);
    expect(res.body.attachment.uploadedBy.name).toBe('Bob');
    expect(res.body.attachment.mimeType).toBe('application/pdf');
  });

  it('accepts text files and decides the type itself, ignoring the browser\'s claim', async () => {
    const { ada, taskId } = await setup();

    const res = await upload(ada.agent, taskId, Buffer.from('a,b\n1,2\n'), 'data.csv', 'application/x-evil');

    expect(res.status).toBe(201);
    expect(res.body.attachment.mimeType).toBe('text/csv');
  });

  it('stores under a server-generated key, never one built from the filename', async () => {
    const { ada, taskId } = await setup();

    const res = await upload(ada.agent, taskId, PNG, '../../etc/passwd/..\\..\\evil name.png');

    expect(res.status).toBe(201);
    expect(res.body.attachment.filename).toBe('evil name.png');
    const stored = await Attachment.findById(res.body.attachment.id).select('+storageKey');
    expect(stored.storageKey).toMatch(new RegExp(`^tasks/${taskId}/[0-9a-f-]{36}\\.png$`));
    expect(stored.storageKey).not.toContain('..');
    expect([...getStorage().objects.keys()]).toEqual([stored.storageKey]);
  });

  it.each([
    ['an unsupported extension', EXE, 'tool.exe', 415],
    ['SVG (can carry scripts)', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo.svg', 415],
    ['no extension', PNG, 'noext', 415],
    ['an executable renamed to .png', EXE, 'virus.png', 415],
    ['a PNG renamed to .pdf', PNG, 'fake.pdf', 415],
    ['a PDF renamed to .png', PDF, 'fake.png', 415],
    ['a plain zip renamed to .docx', EMPTY_ZIP, 'report.docx', 415],
    ['a text file containing NUL bytes', Buffer.from([0x68, 0x69, 0x00, 0x21]), 'bad.txt', 415],
    ['a text file that is not valid UTF-8', Buffer.from([0xff, 0xfe, 0xfd, 0x80]), 'bad.csv', 415],
    ['an empty file', Buffer.alloc(0), 'empty.png', 400],
  ])('rejects %s', async (_name, buffer, filename, status) => {
    const { ada, taskId } = await setup();

    const res = await upload(ada.agent, taskId, buffer, filename, 'image/png');

    expect(res.status).toBe(status);
    expect(res.body.error.message).toBeTruthy();
    expect(await Attachment.countDocuments()).toBe(0);
    expect(getStorage().objects.size).toBe(0);
  });

  it('rejects files over the size limit (5 MB) with 413', async () => {
    const { ada, taskId } = await setup();
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);

    const res = await upload(ada.agent, taskId, big, 'big.png');

    expect(res.status).toBe(413);
    expect(res.body.error.message).toMatch(/too large/i);
    expect(getStorage().objects.size).toBe(0);
  });

  it('rejects a request with no file, the wrong field name, extra files or extra fields', async () => {
    const { ada, taskId } = await setup();
    const url = `/api/tasks/${taskId}/attachments`;

    const none = await ada.agent.post(url).send({});
    const wrongField = await ada.agent.post(url).attach('document', PNG, 'pic.png');
    const twoFiles = await ada.agent.post(url).attach('file', PNG, 'a.png').attach('file', PNG, 'b.png');
    const extraField = await ada.agent.post(url).field('note', 'hi').attach('file', PNG, 'a.png');

    expect(none.status).toBe(400);
    expect(wrongField.status).toBe(400);
    expect(twoFiles.status).toBe(400);
    expect(extraField.status).toBe(400);
    expect(await Attachment.countDocuments()).toBe(0);
  });

  it('allows at most 10 attachments per task', async () => {
    const { ada, taskId } = await setup();
    await Attachment.insertMany(
      Array.from({ length: 10 }, (_, i) => ({
        task: taskId,
        filename: `f${i}.png`,
        mimeType: 'image/png',
        size: 1,
        storageKey: `tasks/${taskId}/seed-${i}.png`,
        uploadedBy: ada.id,
      })),
    );

    const res = await upload(ada.agent, taskId);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/at most 10/);
    expect(getStorage().objects.size).toBe(0);
  });

  it('returns 404 to a user who cannot see the task, and stores nothing', async () => {
    const { cy, taskId } = await setup();

    const res = await upload(cy.agent, taskId);
    const missing = await upload(cy.agent, new mongoose.Types.ObjectId().toString());

    expect(res.status).toBe(404);
    expect(res.body).toEqual(missing.body);
    expect(getStorage().objects.size).toBe(0);
  });

  it('returns 400 for a malformed task id', async () => {
    const { ada } = await setup();

    const res = await upload(ada.agent, 'not-an-id');

    expect(res.status).toBe(400);
  });

  it('removes the stored object when the database write fails', async () => {
    const { ada, taskId } = await setup();
    vi.spyOn(Attachment, 'create').mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await upload(ada.agent, taskId);

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
    expect(getStorage().objects.size).toBe(0);
  });

  it('fails cleanly, with no database row, when storage is down', async () => {
    const { ada, taskId } = await setup();
    vi.spyOn(getStorage(), 'put').mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await upload(ada.agent, taskId);

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
    expect(await Attachment.countDocuments()).toBe(0);
  });
});

describe('listing and metadata', () => {
  it('lists attachments oldest first, for the creator and the assignee', async () => {
    const { ada, bob, taskId } = await setup();
    await upload(ada.agent, taskId, PNG, 'first.png');
    await upload(bob.agent, taskId, PDF, 'second.pdf', 'application/pdf');

    const asCreator = await ada.agent.get(`/api/tasks/${taskId}/attachments`);
    const asAssignee = await bob.agent.get(`/api/tasks/${taskId}/attachments`);

    expect(asCreator.status).toBe(200);
    expect(asCreator.body.attachments.map((a) => a.filename)).toEqual(['first.png', 'second.pdf']);
    expect(asAssignee.body.attachments).toHaveLength(2);
    for (const attachment of asCreator.body.attachments) {
      expect(Object.keys(attachment).sort()).toEqual(['createdAt', 'filename', 'id', 'mimeType', 'size', 'uploadedBy']);
    }
  });

  it('returns an empty list for a task without attachments', async () => {
    const { ada, taskId } = await setup();

    const res = await ada.agent.get(`/api/tasks/${taskId}/attachments`);

    expect(res.body).toEqual({ attachments: [] });
  });

  it('is included in the task detail response', async () => {
    const { ada, taskId } = await setup();
    await upload(ada.agent, taskId);

    const res = await ada.agent.get(`/api/tasks/${taskId}`);

    expect(res.body.task.attachments).toHaveLength(1);
    expect(res.body.task.attachments[0].filename).toBe('pic.png');
    expect(JSON.stringify(res.body)).not.toContain('storageKey');
  });

  it('returns one attachment\'s metadata, and 404 for another task\'s attachment', async () => {
    const { ada, taskId } = await setup();
    const other = (await createTask(ada.agent, { title: 'Other' })).body.task.id;
    const { body } = await upload(ada.agent, taskId);

    const ok = await ada.agent.get(`/api/tasks/${taskId}/attachments/${body.attachment.id}`);
    const wrongTask = await ada.agent.get(`/api/tasks/${other}/attachments/${body.attachment.id}`);

    expect(ok.status).toBe(200);
    expect(ok.body.attachment.id).toBe(body.attachment.id);
    expect(wrongTask.status).toBe(404);
  });

  it('hides everything from users who cannot see the task', async () => {
    const { ada, cy, taskId } = await setup();
    const { body } = await upload(ada.agent, taskId);

    const list = await cy.agent.get(`/api/tasks/${taskId}/attachments`);
    const one = await cy.agent.get(`/api/tasks/${taskId}/attachments/${body.attachment.id}`);

    expect(list.status).toBe(404);
    expect(one.status).toBe(404);
  });
});

describe('download', () => {
  it('streams the exact bytes with safe headers', async () => {
    const { ada, bob, taskId } = await setup();
    const { body } = await upload(ada.agent, taskId, PDF, 'Q3 report — final.pdf', 'application/pdf');
    const url = `/api/tasks/${taskId}/attachments/${body.attachment.id}/download`;

    const asCreator = await ada.agent.get(url).buffer().parse((res, cb) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    const asAssignee = await bob.agent.get(url);

    expect(asCreator.status).toBe(200);
    expect(Buffer.compare(asCreator.body, PDF)).toBe(0);
    expect(asCreator.headers['content-type']).toBe('application/pdf');
    expect(asCreator.headers['content-length']).toBe(String(PDF.length));
    expect(asCreator.headers['x-content-type-options']).toBe('nosniff');
    expect(asCreator.headers['cache-control']).toBe('private, no-store');
    expect(asCreator.headers['content-disposition']).toMatch(/^attachment; filename="Q3 report _ final\.pdf"; filename\*=UTF-8''Q3%20report%20%E2%80%94%20final\.pdf$/);
    expect(asAssignee.status).toBe(200);
  });

  it('returns 404 to a user who cannot see the task', async () => {
    const { ada, cy, taskId } = await setup();
    const { body } = await upload(ada.agent, taskId);

    const res = await cy.agent.get(`/api/tasks/${taskId}/attachments/${body.attachment.id}/download`);

    expect(res.status).toBe(404);
    expect(res.headers['content-disposition']).toBeUndefined();
  });

  it('returns 404 when the stored file is missing, and 404 for an unknown attachment', async () => {
    const { ada, taskId } = await setup();
    const { body } = await upload(ada.agent, taskId);
    getStorage().objects.clear(); // the object vanished from storage

    const missingFile = await ada.agent.get(`/api/tasks/${taskId}/attachments/${body.attachment.id}/download`);
    const unknown = await ada.agent.get(`/api/tasks/${taskId}/attachments/${new mongoose.Types.ObjectId()}/download`);

    expect(missingFile.status).toBe(404);
    expect(missingFile.body.error.message).toBe('The file is no longer available');
    expect(unknown.status).toBe(404);
  });

  it('returns 400 for malformed ids', async () => {
    const { ada, taskId } = await setup();

    const res = await ada.agent.get(`/api/tasks/${taskId}/attachments/nope/download`);

    expect(res.status).toBe(400);
  });
});

describe('delete', () => {
  it('lets the task creator delete any attachment, removing the row and the file', async () => {
    const { ada, bob, taskId } = await setup();
    const { body } = await upload(bob.agent, taskId);

    const res = await ada.agent.delete(`/api/tasks/${taskId}/attachments/${body.attachment.id}`);

    expect(res.status).toBe(204);
    expect(await Attachment.countDocuments()).toBe(0);
    expect(getStorage().objects.size).toBe(0);
    expect((await ada.agent.get(`/api/tasks/${taskId}/attachments/${body.attachment.id}`)).status).toBe(404);
  });

  it('lets an assignee delete their own upload but not the creator\'s', async () => {
    const { ada, bob, taskId } = await setup();
    const mine = await upload(bob.agent, taskId, PNG, 'mine.png');
    const theirs = await upload(ada.agent, taskId, PNG, 'theirs.png');

    const forbidden = await bob.agent.delete(`/api/tasks/${taskId}/attachments/${theirs.body.attachment.id}`);
    const allowed = await bob.agent.delete(`/api/tasks/${taskId}/attachments/${mine.body.attachment.id}`);

    expect(forbidden.status).toBe(403);
    expect(allowed.status).toBe(204);
    expect((await Attachment.find()).map((a) => a.filename)).toEqual(['theirs.png']);
    expect(getStorage().objects.size).toBe(1);
  });

  it('returns 404 to unrelated users and changes nothing', async () => {
    const { ada, cy, taskId } = await setup();
    const { body } = await upload(ada.agent, taskId);

    const res = await cy.agent.delete(`/api/tasks/${taskId}/attachments/${body.attachment.id}`);

    expect(res.status).toBe(404);
    expect(await Attachment.countDocuments()).toBe(1);
    expect(getStorage().objects.size).toBe(1);
  });

  it('returns 404 for an attachment that does not exist or belongs to another task', async () => {
    const { ada, taskId } = await setup();
    const other = (await createTask(ada.agent, { title: 'Other' })).body.task.id;
    const { body } = await upload(ada.agent, taskId);

    const missing = await ada.agent.delete(`/api/tasks/${taskId}/attachments/${new mongoose.Types.ObjectId()}`);
    const wrongTask = await ada.agent.delete(`/api/tasks/${other}/attachments/${body.attachment.id}`);

    expect(missing.status).toBe(404);
    expect(wrongTask.status).toBe(404);
    expect(await Attachment.countDocuments()).toBe(1);
  });

  it('still succeeds when the stored object cannot be removed (the row is gone, the failure is logged)', async () => {
    const { ada, taskId } = await setup();
    const { body } = await upload(ada.agent, taskId);
    vi.spyOn(getStorage(), 'remove').mockRejectedValueOnce(new Error('storage down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await ada.agent.delete(`/api/tasks/${taskId}/attachments/${body.attachment.id}`);

    expect(res.status).toBe(204);
    expect(await Attachment.countDocuments()).toBe(0);
    expect(log).toHaveBeenCalled();
    expect(log.mock.calls.flat().join(' ')).not.toMatch(/password|secret/i);
  });

  it('is removed together with its task', async () => {
    const { ada, taskId } = await setup();
    await upload(ada.agent, taskId);
    await upload(ada.agent, taskId, PDF, 'b.pdf', 'application/pdf');
    expect(getStorage().objects.size).toBe(2);

    const res = await ada.agent.delete(`/api/tasks/${taskId}`);

    expect(res.status).toBe(204);
    expect(await Attachment.countDocuments()).toBe(0);
    expect(getStorage().objects.size).toBe(0);
  });
});
