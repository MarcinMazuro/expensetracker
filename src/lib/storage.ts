import "server-only";
import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";

/**
 * Receipt photos in a private bucket. They are never public - the app
 * streams them to their owner after checking the session (/api/receipts).
 */
let storage: Storage | null = null;

function bucket() {
  const name = process.env.RECEIPTS_BUCKET;
  if (!name) throw new Error("RECEIPTS_BUCKET is not set");
  storage ??= new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "expensetracker-mm" });
  return storage.bucket(name);
}

/** Local development writes under dev/ so test photos never mix with real ones. */
const prefix = () => (process.env.NODE_ENV === "production" ? "receipts" : "dev/receipts");

export function ownsReceipt(uid: string, path: string): boolean {
  return path.startsWith(`${prefix()}/${uid}/`) && !path.includes("..");
}

export async function saveReceipt(uid: string, data: Buffer, mimeType: string): Promise<string> {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${prefix()}/${uid}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${extension}`;
  await bucket().file(path).save(data, { contentType: mimeType, resumable: false });
  return path;
}

export async function readReceiptFile(path: string): Promise<{ data: Buffer; contentType: string } | null> {
  const file = bucket().file(path);
  try {
    const [[data], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    return { data, contentType: metadata.contentType ?? "image/jpeg" };
  } catch {
    return null;
  }
}

export async function deleteReceiptFile(path: string) {
  await bucket().file(path).delete({ ignoreNotFound: true });
}
