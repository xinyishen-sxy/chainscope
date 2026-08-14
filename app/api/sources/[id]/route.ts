import { listSources, runtimeDb } from "../../../../lib/runtime-data";
export async function GET(_request: Request, context: { params:Promise<{ id:string }> }) {
  const { id } = await context.params; const source = (await listSources()).find((item) => item.id === id);
  if (!source) return Response.json({ error:"source not found" }, { status:404 });
  const db = runtimeDb(); const chunks = db ? ((await db.prepare("SELECT id, section, content, ordinal, language, page_number FROM chunks WHERE source_id = ? ORDER BY ordinal LIMIT 100").bind(id).all<Record<string, unknown>>()).results ?? []) : [];
  return Response.json({ source, chunks });
}
