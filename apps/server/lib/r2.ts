import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2AccountId = process.env.R2_ACCOUNT_ID ?? "";
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
const r2BucketName = process.env.R2_BUCKET_NAME ?? "";
const r2PublicDomain = process.env.R2_PUBLIC_DOMAIN ?? "";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

function assertR2Config(): void {
  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName || !r2PublicDomain) {
    throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_DOMAIN must be set");
  }
}

export async function getUploadUrl(key: string, contentType?: string): Promise<string> {
  assertR2Config();

  const command = new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    ...(contentType ? { ContentType: contentType } : {}),
  });

  return getSignedUrl(r2Client, command, { expiresIn: 15 * 60 });
}

export function getPublicUrl(key: string): string {
  assertR2Config();
  return `https://${r2PublicDomain}/${key}`;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function avatarKey(userId: string, fileName: string, timestamp = Date.now()): string {
  return `avatars/${userId}/${timestamp}-${sanitizeFileName(fileName)}`;
}

export function deliverableKey(campaignId: string, userId: string, fileName: string, timestamp = Date.now()): string {
  return `deliverables/${campaignId}/${userId}/${timestamp}-${sanitizeFileName(fileName)}`;
}

export function kycKey(userId: string, fileName: string, timestamp = Date.now()): string {
  return `kyc/${userId}/${timestamp}-${sanitizeFileName(fileName)}`;
}
