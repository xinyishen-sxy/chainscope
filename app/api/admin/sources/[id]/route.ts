import { isAdmin } from "../../../../../lib/security";
const actions = ["approved", "rejected", "archived"];
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return Response.json({ error: "admin access required" }, { status: 403 });
  const { id } = await context.params;
  const payload = await request.json() as { status?: string };
  if (!payload.status || !actions.includes(payload.status)) return Response.json({ error: "invalid review status" }, { status: 400 });
  return Response.json({ id, status: payload.status, indexed: payload.status === "approved" });
}
