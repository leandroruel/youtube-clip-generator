import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';
import type { S3Client } from '@aws-sdk/client-s3';

export async function ensureBucket(client: S3Client, bucket: string) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function uploadStream(
  client: S3Client,
  bucket: string,
  key: string,
  stream: Readable,
  contentType?: string,
) {
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: contentType,
    },
  });

  return upload.done();
}

export async function uploadBuffer(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType?: string,
) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  return client.send(command);
}

export async function getObject(
  client: S3Client,
  bucket: string,
  key: string,
) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return client.send(command);
}

export async function deleteObject(
  client: S3Client,
  bucket: string,
  key: string,
) {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  return client.send(command);
}
