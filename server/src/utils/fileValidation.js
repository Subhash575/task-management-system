import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from './AppError.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const MAX_ATTACHMENTS_PER_TASK = 10;

// Every allowed type, by extension. "binary" files must have a matching signature ("magic bytes") inside the
// file itself; "text" files have none, so they must be valid UTF-8 without NUL bytes. SVG and HTML are left out
// on purpose, because they can carry scripts.
const ALLOWED_TYPES = {
  '.png': { mime: 'image/png', kind: 'binary' },
  '.jpg': { mime: 'image/jpeg', kind: 'binary' },
  '.jpeg': { mime: 'image/jpeg', kind: 'binary' },
  '.gif': { mime: 'image/gif', kind: 'binary' },
  '.webp': { mime: 'image/webp', kind: 'binary' },
  '.pdf': { mime: 'application/pdf', kind: 'binary' },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'binary' },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'binary' },
  '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'binary' },
  '.txt': { mime: 'text/plain', kind: 'text' },
  '.csv': { mime: 'text/csv', kind: 'text' },
  '.md': { mime: 'text/markdown', kind: 'text' },
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_TYPES);

/** A safe name to show and to put in the download header: no folders, no control characters, bounded length. */
export function sanitizeFilename(name) {
  const base = String(name ?? '')
    .normalize('NFC')
    .split(/[\\/]/)
    .pop()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '')
    .trim()
    .replace(/^\.+/, ''); // no hidden or "..", leading dots
  const { name: stem, ext } = path.parse(base);
  const shortStem = stem.slice(0, Math.max(1, 150 - ext.length));
  return `${shortStem || 'file'}${ext}`;
}

function isUtf8Text(buffer) {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks an uploaded file by what it really is, not by what the browser claims: the extension must be on the
 * allow-list and the bytes must match it. Returns the values to store; the browser's MIME type is never used.
 */
export async function inspectUpload({ originalname, buffer }) {
  const filename = sanitizeFilename(originalname);
  const extension = path.extname(filename).toLowerCase();
  const allowed = ALLOWED_TYPES[extension];

  if (!allowed) {
    throw new AppError(415, `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'The file is empty');
  }

  const matchesContent =
    allowed.kind === 'text' ? isUtf8Text(buffer) : (await fileTypeFromBuffer(buffer))?.mime === allowed.mime;
  if (!matchesContent) {
    throw new AppError(415, 'The file content does not match its file type');
  }

  return { filename, extension, mimeType: allowed.mime, size: buffer.length };
}
