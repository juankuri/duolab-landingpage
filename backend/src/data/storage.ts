// The only module that touches R2. Keeping the bucket behind these four
// functions is what makes the key layout an implementation detail: nothing
// outside this file builds or sees an object key.

/**
 * Keys are derived from ids, never from the uploaded filename, so a name like
 * "../../other.pdf" cannot influence where the object lands.
 */
export function resultKey(recordId: string, fileId: string): string {
  return `records/${recordId}/${fileId}.pdf`;
}

export function putResult(
  bucket: R2Bucket,
  key: string,
  file: File,
  metadata: { recordId: string; fileId: string },
) {
  return bucket.put(key, file.stream(), {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      originalFilename: file.name,
      recordId: metadata.recordId,
      fileId: metadata.fileId,
    },
  });
}

export function getResult(bucket: R2Bucket, key: string) {
  return bucket.get(key);
}

export function deleteResult(bucket: R2Bucket, key: string) {
  return bucket.delete(key);
}
