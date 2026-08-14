import { runtimeDb } from "../../../../lib/runtime-data";
import { isAdmin } from "../../../../lib/security";

type Bundle = { sources?: Record<string, unknown>[]; chunks?: Record<string, unknown>[] };
export async function POST(request: Request) {
  if (!isAdmin(request)) return Response.json({ error:"admin access required" }, { status:403 });
  const db = runtimeDb(); if (!db) return Response.json({ error:"D1 unavailable" }, { status:503 });
  const payload = await request.json() as Bundle; const now = new Date().toISOString();
  let sources = 0, chunks = 0;
  for (const source of payload.sources ?? []) {
    await db.prepare(`INSERT INTO sources (id, canonical_url, doi, title, topic, source_type, authors_json, publication_year, license, status, content_hash, last_synced_at, created_at, updated_at, open_access_url, content_scope, fulltext_status, sync_error, collection, orcid, cited_by_count, citation_provider, abstract)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, 'lab', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET canonical_url=excluded.canonical_url, doi=excluded.doi, title=excluded.title, authors_json=excluded.authors_json, publication_year=excluded.publication_year, content_hash=excluded.content_hash, updated_at=excluded.updated_at, open_access_url=excluded.open_access_url, content_scope=excluded.content_scope, fulltext_status=excluded.fulltext_status, sync_error=excluded.sync_error, abstract=excluded.abstract`)
      .bind(source.id, source.url, source.doi ?? null, source.title, source.topic ?? "lab", source.source_type ?? "paper", JSON.stringify(source.authors ?? []), source.year ?? new Date().getFullYear(), source.license ?? "metadata-only", source.content_hash ?? null, now, now, now, source.open_access_url ?? null, source.content_scope ?? "metadata", source.content_scope === "open_fulltext" ? "fulltext_indexed" : source.content_scope === "abstract" ? "abstract_indexed" : "metadata_only", source.sync_error ?? null, source.orcid ?? "0000-0001-5870-5730", source.cited_by_count ?? null, source.citation_provider ?? null, source.abstract ?? null).run(); sources++;
  }
  for (const chunk of payload.chunks ?? []) {
    const existing = await db.prepare("SELECT content_hash FROM chunks WHERE id = ?").bind(chunk.id).first<{ content_hash:string }>();
    if (existing?.content_hash === chunk.content_hash) continue;
    await db.batch([
      db.prepare("INSERT OR REPLACE INTO chunks (id, source_id, section, content, token_count, ordinal, vector_id, created_at, language, page_number, content_hash, vector_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(chunk.id, chunk.source_id, chunk.section, chunk.content, chunk.token_count, chunk.ordinal, chunk.id, now, chunk.language ?? "en", chunk.page_number ?? null, chunk.content_hash ?? null, chunk.vector_version ?? "text-embedding-v4-1024"),
      db.prepare("DELETE FROM chunks_fts WHERE chunk_id = ?").bind(chunk.id),
      db.prepare("INSERT INTO chunks_fts (chunk_id, source_id, title, section, content) VALUES (?, ?, ?, ?, ?)").bind(chunk.id, chunk.source_id, chunk.title, chunk.section, chunk.content),
    ]); chunks++;
  }
  return Response.json({ status:"published", sources, chunks, skipped:(payload.chunks?.length ?? 0) - chunks, finishedAt:now });
}
