import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageObjectMissingError } from './errors.js';

/**
 * Durable object storage for production. Works with AWS S3 and S3-compatible services
 * (Cloudflare R2, MinIO, ...) by setting S3_ENDPOINT. The bucket must stay private: files are only
 * ever served through the authorized download route, never through a public bucket URL.
 */
export function createS3Storage({ bucket, region, endpoint, accessKeyId, secretAccessKey, forcePathStyle }) {
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    async put(key, buffer, { contentType }) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType, ContentLength: buffer.length }),
      );
    },
    async getStream(key) {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return response.Body; // a Node.js Readable
      } catch (error) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) throw new StorageObjectMissingError(key);
        throw error;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); // S3 does not fail for missing keys
    },
  };
}
