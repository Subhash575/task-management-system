import { randomUUID } from 'node:crypto';
import { Attachment } from '../models/Attachment.js';
import { getStorage } from '../storage/index.js';
import { StorageObjectMissingError } from '../storage/errors.js';
import { AppError } from '../utils/AppError.js';
import { MAX_ATTACHMENTS_PER_TASK, inspectUpload } from '../utils/fileValidation.js';
import { USER_SUMMARY, findVisibleTask } from './taskAccess.js';

const populateUploader = { path: 'uploadedBy', select: USER_SUMMARY };

/** Storage failures after the database was already updated are only logged: they must not fail the request. */
function logStorageProblem(action, error) {
  console.error(`[attachments] could not ${action}:`, error.message);
}

/** Attachments of a task, oldest first. Callers must already have checked that the user may see the task. */
export async function listAttachmentsForTask(taskId) {
  const attachments = await Attachment.find({ task: taskId }).sort({ createdAt: 1, _id: 1 }).populate(populateUploader);
  return attachments.map((attachment) => attachment.toJSON());
}

export async function listAttachments(user, taskId) {
  await findVisibleTask(taskId, user.id);
  return listAttachmentsForTask(taskId);
}

/** Loads one attachment of a task the user may see. A wrong id, or an id from another task, is just "not found". */
async function findAttachment(user, taskId, attachmentId, { withStorageKey = false } = {}) {
  await findVisibleTask(taskId, user.id);
  const query = Attachment.findOne({ _id: attachmentId, task: taskId });
  if (withStorageKey) query.select('+storageKey');
  const attachment = await query;
  if (!attachment) throw new AppError(404, 'Attachment not found');
  return attachment;
}

export async function getAttachment(user, taskId, attachmentId) {
  const attachment = await findAttachment(user, taskId, attachmentId);
  return attachment.populate(populateUploader);
}

/**
 * Anyone who can see the task (its creator or its assignee) may attach files to it.
 * The file is stored first and the database row second; if the row can't be saved the object is removed again.
 */
export async function uploadAttachment(user, taskId, file) {
  const task = await findVisibleTask(taskId, user.id);

  if ((await Attachment.countDocuments({ task: task._id })) >= MAX_ATTACHMENTS_PER_TASK) {
    throw new AppError(400, `A task can have at most ${MAX_ATTACHMENTS_PER_TASK} attachments`);
  }

  const { filename, extension, mimeType, size } = await inspectUpload(file);

  // The key is built only from ids we generated and an extension from our allow-list, so nothing the
  // user typed (such as the filename) can influence where the file is stored.
  const storageKey = `tasks/${task.id}/${randomUUID()}${extension}`;
  const storage = getStorage();

  await storage.put(storageKey, file.buffer, { contentType: mimeType });

  let attachment;
  try {
    attachment = await Attachment.create({ task: task._id, filename, mimeType, size, storageKey, uploadedBy: user.id });
  } catch (error) {
    await storage.remove(storageKey).catch((cleanupError) => logStorageProblem('remove an orphaned object', cleanupError));
    throw error;
  }

  return attachment.populate(populateUploader);
}

/** Returns the attachment's metadata and a readable stream of its bytes. */
export async function openAttachment(user, taskId, attachmentId) {
  const attachment = await findAttachment(user, taskId, attachmentId, { withStorageKey: true });

  try {
    const stream = await getStorage().getStream(attachment.storageKey);
    return { attachment, stream };
  } catch (error) {
    if (error instanceof StorageObjectMissingError) throw new AppError(404, 'The file is no longer available');
    throw error;
  }
}

/** The task's creator may delete any attachment; everyone else only the files they uploaded themselves. */
export async function deleteAttachment(user, taskId, attachmentId) {
  const task = await findVisibleTask(taskId, user.id);
  const attachment = await Attachment.findOne({ _id: attachmentId, task: task._id }).select('+storageKey');
  if (!attachment) throw new AppError(404, 'Attachment not found');

  const isTaskCreator = task.creator.equals(user.id);
  const isUploader = attachment.uploadedBy.equals(user.id);
  if (!isTaskCreator && !isUploader) {
    throw new AppError(403, 'Only the task creator or the uploader can delete this attachment');
  }

  // Database first: a leftover object is harmless garbage, whereas a row pointing at a deleted object is a broken link.
  await attachment.deleteOne();
  await getStorage()
    .remove(attachment.storageKey)
    .catch((error) => logStorageProblem('remove a deleted attachment', error));
}

/** Used when a task is deleted: removes every attachment row and, best effort, every stored object. */
export async function deleteAttachmentsForTask(taskId) {
  const attachments = await Attachment.find({ task: taskId }).select('+storageKey');
  await Attachment.deleteMany({ task: taskId });
  await Promise.all(
    attachments.map((attachment) =>
      getStorage()
        .remove(attachment.storageKey)
        .catch((error) => logStorageProblem('remove an attachment of a deleted task', error)),
    ),
  );
}
