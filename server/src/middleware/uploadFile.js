import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { MAX_UPLOAD_BYTES } from '../utils/fileValidation.js';

// Files are held in memory (at most MAX_UPLOAD_BYTES) so the real content can be inspected before anything is stored.
// One file, in a field called "file", and nothing else: no extra fields, no extra parts.
const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8', // browsers send filenames as UTF-8; Multer's default (latin1) would garble accents and emoji
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 2 },
}).single('file');

/** Parses a multipart upload into `req.file`, turning Multer's errors into the project's normal errors. */
export function uploadFile(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(413, `The file is too large. The maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`));
    }
    if (error instanceof multer.MulterError) {
      return next(new AppError(400, 'Send exactly one file in the "file" field'));
    }
    // Not a Multer error: e.g. a malformed multipart body.
    return next(new AppError(400, 'The upload could not be read'));
  });
}
