import { receiptVisibleTo } from "@/lib/expenses";
import { currentUser } from "@/lib/session";
import { activeUsers } from "@/lib/users";
import { ownsReceipt, readReceiptFile } from "@/lib/storage";

export const runtime = "nodejs";

/** Streams a receipt photo to people in the household. The bucket itself is private. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const path = new URL(request.url).searchParams.get("path") ?? "";
  // Everyone in the household sees everyone's receipts, except those of hidden
  // expenses. The owner's id is in the path
  const owner = (await activeUsers()).find((p) => ownsReceipt(p.id, path));
  if (!owner || !(await receiptVisibleTo(user.id, owner.id, path))) return new Response("Not found", { status: 404 });

  const file = await readReceiptFile(path);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.contentType, "cache-control": "private, max-age=86400" },
  });
}
