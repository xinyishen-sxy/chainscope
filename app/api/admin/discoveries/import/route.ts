import { isAdmin } from "../../../../../lib/security";
export async function POST(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "admin access required" }, { status: 403 });
  const payload = await request.json() as { sources?: unknown[] };
  return Response.json({ imported: payload.sources?.length ?? 0, status: "pending_review" }, { status: 202 });
}
