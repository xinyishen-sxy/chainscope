import { runtimeDb } from "./runtime-data";

const VISITOR_LIMIT = 5;
const GLOBAL_LIMIT = Number(process.env.DAILY_GENERATION_LIMIT ?? 200);
const SEARCH_LIMIT = Number(process.env.SEARCH_RATE_LIMIT_PER_MINUTE ?? 30);

function dayParts() { const day = new Date().toISOString().slice(0, 10); return { day, resetsAt:`${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z` }; }
async function sha256(value: string) { const bytes = new TextEncoder().encode(value); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function visitorIdentity(request: Request) {
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)chainscope_visitor=([a-zA-Z0-9_-]{16,80})/)?.[1];
  const id = cookie ?? crypto.randomUUID().replaceAll("-", "");
  const hash = await sha256(`${id}:${process.env.VISITOR_HASH_SALT ?? "chainscope-public-demo"}`);
  return { id, hash, isNew:!cookie };
}

export async function quotaStatus(visitorHash: string) {
  const { day, resetsAt } = dayParts(); const db = runtimeDb();
  if (!db) return { allowed:false, remaining:0, limit:VISITOR_LIMIT, resetsAt, globalRemaining:0 };
  const visitor = await db.prepare("SELECT generated_count FROM visitor_usage WHERE visitor_hash = ? AND day = ?").bind(visitorHash, day).first<{ generated_count:number }>();
  const global = await db.prepare("SELECT generated_count FROM global_usage WHERE day = ?").bind(day).first<{ generated_count:number }>();
  const count = visitor?.generated_count ?? 0; const globalCount = global?.generated_count ?? 0;
  return { allowed:count < VISITOR_LIMIT && globalCount < GLOBAL_LIMIT, remaining:Math.max(0, VISITOR_LIMIT - count), limit:VISITOR_LIMIT, resetsAt, globalRemaining:Math.max(0, GLOBAL_LIMIT - globalCount) };
}

export async function consumeQuota(visitorHash: string) {
  const status = await quotaStatus(visitorHash); if (!status.allowed) return status;
  const db = runtimeDb(); if (!db) return status; const { day } = dayParts(); const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO visitor_usage (visitor_hash, day, generated_count, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(visitor_hash, day) DO UPDATE SET generated_count = generated_count + 1, updated_at = excluded.updated_at").bind(visitorHash, day, now),
    db.prepare("INSERT INTO global_usage (day, generated_count, input_tokens, output_tokens, updated_at) VALUES (?, 1, 0, 0, ?) ON CONFLICT(day) DO UPDATE SET generated_count = generated_count + 1, updated_at = excluded.updated_at").bind(day, now),
  ]);
  return { ...status, remaining:Math.max(0, status.remaining - 1) };
}

export async function consumeSearchRate(visitorHash: string) {
  const db = runtimeDb();
  if (!db) return { allowed:true, remaining:SEARCH_LIMIT };
  const minute = new Date().toISOString().slice(0, 16); const now = new Date().toISOString();
  const current = await db.prepare("SELECT request_count FROM rate_limit_events WHERE visitor_hash = ? AND minute_bucket = ?").bind(visitorHash, minute).first<{ request_count:number }>();
  if ((current?.request_count ?? 0) >= SEARCH_LIMIT) return { allowed:false, remaining:0 };
  await db.prepare("INSERT INTO rate_limit_events (visitor_hash, minute_bucket, request_count, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(visitor_hash, minute_bucket) DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at").bind(visitorHash, minute, now).run();
  return { allowed:true, remaining:Math.max(0, SEARCH_LIMIT - (current?.request_count ?? 0) - 1) };
}

export async function recordRequest(input: { visitorHash:string; mode:string; status:string; retrievalMode:string; inputTokens?:number; outputTokens?:number; latencyMs:number; errorCode?:string }) {
  const db = runtimeDb(); if (!db) return; const now = new Date().toISOString();
  await db.prepare("INSERT INTO rag_requests (id, visitor_hash, mode, status, retrieval_mode, input_tokens, output_tokens, latency_ms, created_at, error_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), input.visitorHash, input.mode, input.status, input.retrievalMode, input.inputTokens ?? 0, input.outputTokens ?? 0, input.latencyMs, now, input.errorCode ?? null).run();
  if ((input.inputTokens ?? 0) + (input.outputTokens ?? 0) > 0) await db.prepare("UPDATE global_usage SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, updated_at = ? WHERE day = ?").bind(input.inputTokens ?? 0, input.outputTokens ?? 0, now, now.slice(0, 10)).run();
}
