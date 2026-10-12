import { pipeline } from 'node:stream/promises';
import * as attachmentService from '../services/attachment.service.js';
import { AppError } from '../utils/AppError.js';

// Identity always comes from req.user (set by requireAuth), never from the request.

export async function listAttachments(req, res) {
  const attachments = await attachmentService.listAttachments(req.user, req.validated.params.id);
  res.status(200).json({ attachments });
}

export async function uploadAttachment(req, res) {
  if (!req.file) throw new AppError(400, 'No file was uploaded. Send one file in the "file" field.');
  const attachment = await attachmentService.uploadAttachment(req.user, req.validated.params.id, req.file);
  res.status(201).json({ attachment });
}

export async function getAttachment(req, res) {
  const { id, attachmentId } = req.validated.params;
  const attachment = await attachmentService.getAttachment(req.user, id, attachmentId);
  res.status(200).json({ attachment });
}

/** Builds a Content-Disposition value that is safe for any filename (RFC 6266 / 5987). */
function attachmentDisposition(filename) {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function downloadAttachment(req, res, next) {
  const { id, attachmentId } = req.validated.params;
  const { attachment, stream } = await attachmentService.openAttachment(req.user, id, attachmentId);

  // Always a download (never rendered inside our origin), with the type decided at upload time and no sniffing.
  res.set({
    'Content-Type': attachment.mimeType,
    'Content-Length': String(attachment.size),
    'Content-Disposition': attachmentDisposition(attachment.filename),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });

  try {
    await pipeline(stream, res);
  } catch (error) {
    // Headers are already sent, so the response can't be turned into a JSON error any more.
    if (res.headersSent) res.destroy(error);
    else next(error);
  }
}

export async function deleteAttachment(req, res) {
  const { id, attachmentId } = req.validated.params;
  await attachmentService.deleteAttachment(req.user, id, attachmentId);
  res.status(204).end();
}
