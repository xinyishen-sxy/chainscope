import { env } from "cloudflare:workers";
import { DEMO_RESULTS, DEMO_SOURCES } from "./demo-data";
import type { EvaluationRun, SearchResult, Source } from "./types";

type D1Result<T> = { results?: T[]; success?: boolean };
type D1Statement = { bind(...values: unknown[]): D1Statement; all<T>(): Promise<D1Result<T>>; first<T>(): Promise<T | null>; run(): Promise<unknown> };
type D1DatabaseLike = { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown> };

export function runtimeDb(): D1DatabaseLike | null {
  return ((env as unknown as { DB?: D1DatabaseLike }).DB ?? null);
}

export async function ensureSeedData() {
  const db = runtimeDb();
  if (!db) return false;
  const seeded = await db.prepare("SELECT value FROM system_state WHERE key = ?").bind("seed-v4").first<{ value: string }>();
  if (seeded) return true;
  const now = new Date().toISOString();
  const sourceStatements = DEMO_SOURCES.map((source) => db.prepare(`INSERT OR IGNORE INTO sources
    (id, canonical_url, doi, title, topic, source_type, authors_json, publication_year, license, status, content_hash, last_synced_at, created_at, updated_at, open_access_url, content_scope, fulltext_status, sync_error, collection, orcid, cited_by_count, citation_provider, abstract)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(source.id, source.url, source.doi ?? null, source.title, source.topic, source.type, JSON.stringify(source.authors), source.year, source.license, source.status, null, source.lastSyncedAt, now, now, source.openAccessUrl ?? null, source.contentScope ?? (source.abstract ? "abstract" : "metadata"), source.fulltextStatus ?? (source.abstract ? "abstract_indexed" : "metadata_only"), source.syncError ?? null, source.collection ?? "official", source.orcid ?? null, source.citedByCount ?? null, source.citationProvider ?? null, source.abstract ?? null));
  const chunkStatements = DEMO_RESULTS.map((result, ordinal) => db.prepare(`INSERT OR IGNORE INTO chunks
    (id, source_id, section, content, token_count, ordinal, vector_id, created_at, language, page_number, content_hash, vector_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(result.chunkId, result.sourceId, result.section, result.snippet, result.snippet.split(/\s+/).length, ordinal, result.chunkId, now, result.language ?? "en", result.pageNumber ?? null, null, "curated-v1"));
  const ftsStatements = DEMO_RESULTS.map((result) => db.prepare("INSERT INTO chunks_fts (chunk_id, source_id, title, section, content) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM chunks_fts WHERE chunk_id = ?)")
    .bind(result.chunkId, result.sourceId, result.title, result.section, result.snippet, result.chunkId));
  await db.batch([...sourceStatements, ...chunkStatements, ...ftsStatements, db.prepare("INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, ?)").bind("seed-v4", "complete", now)]);
  return true;
}

export async function listSources(): Promise<Source[]> {
  const db = runtimeDb();
  if (!db) return DEMO_SOURCES;
  await ensureSeedData();
  const rows = (await db.prepare("SELECT * FROM sources ORDER BY publication_year DESC, title").all<Record<string, unknown>>()).results ?? [];
  return rows.map((row) => ({ id:String(row.id), title:String(row.title), url:String(row.canonical_url), topic:row.topic as Source["topic"], type:row.source_type as Source["type"], authors:JSON.parse(String(row.authors_json ?? "[]")), year:Number(row.publication_year), license:String(row.license), status:row.status as Source["status"], lastSyncedAt:String(row.last_synced_at), doi:row.doi ? String(row.doi) : undefined, abstract:row.abstract ? String(row.abstract) : undefined, collection:row.collection as Source["collection"], citedByCount:row.cited_by_count == null ? undefined : Number(row.cited_by_count), citationProvider:row.citation_provider as Source["citationProvider"], orcid:row.orcid ? String(row.orcid) : undefined, openAccessUrl:row.open_access_url ? String(row.open_access_url) : undefined, contentScope:row.content_scope as Source["contentScope"], fulltextStatus:row.fulltext_status as Source["fulltextStatus"], syncError:row.sync_error ? String(row.sync_error) : undefined }));
}

export async function keywordSearch(query: string, topic: string, limit = 20): Promise<SearchResult[]> {
  const db = runtimeDb();
  if (!db) return [];
  await ensureSeedData();
  const terms = (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((term) => term.length > 1).slice(0, 12);
  if (!terms.length) return [];
  const match = terms.map((term) => `"${term.replaceAll('"', '')}"`).join(" OR ");
  const topicClause = topic && topic !== "all" ? "AND s.topic = ?" : "";
  const statement = db.prepare(`SELECT f.chunk_id, f.source_id, f.title, f.section, f.content, s.topic, s.source_type, s.authors_json, s.publication_year, s.canonical_url, bm25(chunks_fts) AS rank
    FROM chunks_fts f JOIN sources s ON s.id = f.source_id WHERE chunks_fts MATCH ? ${topicClause} ORDER BY rank LIMIT ?`);
  const bound = topicClause ? statement.bind(match, topic, limit) : statement.bind(match, limit);
  const rows = (await bound.all<Record<string, unknown>>()).results ?? [];
  return rows.map((row, index) => ({ chunkId:String(row.chunk_id), sourceId:String(row.source_id), title:String(row.title), url:String(row.canonical_url), section:String(row.section), snippet:String(row.content), topic:row.topic as SearchResult["topic"], sourceType:row.source_type as SearchResult["sourceType"], authors:JSON.parse(String(row.authors_json ?? "[]")), year:Number(row.publication_year), scores:{ vector:0, keyword:Math.max(.25, 1 - index / Math.max(3, rows.length)), fusion:0, rerank:0 }, retrievalMode:"keyword_only" }));
}

export async function latestEvaluation(): Promise<EvaluationRun | null> {
  const db = runtimeDb();
  if (!db) return null;
  const row = await db.prepare("SELECT * FROM evaluation_runs ORDER BY run_at DESC LIMIT 1").first<Record<string, unknown>>();
  if (!row) return null;
  const parsed = JSON.parse(String(row.metrics_json));
  return { version:String(row.version), runAt:String(row.run_at), datasetSize:Number(row.dataset_size), metrics:parsed.metrics, comparisons:parsed.comparisons ?? [], state:"completed", passed:Boolean(row.passed), notes:row.notes ? String(row.notes) : undefined };
}
