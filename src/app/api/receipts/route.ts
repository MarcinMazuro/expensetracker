import { currentUser } from "@/lib/session";
import { ownsReceipt, readReceiptFile } from "@/lib/storage";

export const runtime = "nodejs";

/** Streams a receipt photo to its owner. The bucket itself is private. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!ownsReceipt(user.id, path)) return new Response("Not found", { status: 404 });

  const file = await readReceiptFile(path);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.contentType, "cache-control": "private, max-age=86400" },
  });
}
