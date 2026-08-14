import { KeywordSearchProvider, getSearchProvider, hasHybridConfig, searchWithMethod, type RetrievalMethod } from "../../../lib/providers";
import { consumeSearchRate, visitorIdentity } from "../../../lib/quota";
import type { Topic } from "../../../lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url); const query = url.searchParams.get("q")?.trim() ?? ""; const topic = (url.searchParams.get("topic") ?? "all") as Topic | "all";
  const requestedMethod = url.searchParams.get("method") as RetrievalMethod | null;
  const adminEvaluation = Boolean(process.env.EVALUATION_ADMIN_TOKEN && request.headers.get("authorization") === `Bearer ${process.env.EVALUATION_ADMIN_TOKEN}`);
  if (!query) return Response.json({ error:"q is required" }, { status:400 });
  if (query.length > 500) return Response.json({ error:"query exceeds 500 characters" }, { status:400 });
  const identity = await visitorIdentity(request); const rate = adminEvaluation ? { allowed:true, remaining:-1 } : await consumeSearchRate(identity.hash);
  if (!rate.allowed) return Response.json({ error:"search rate limit exceeded", retry_after_seconds:60 }, { status:429 });
  const started = Date.now(); let degraded = false; let results;
  try { results = requestedMethod && adminEvaluation ? await searchWithMethod(requestedMethod, query, topic) : await getSearchProvider().search(query, { topic }); }
  catch { degraded = true; results = await new KeywordSearchProvider().search(query, { topic }); }
  const retrievalMode = results[0]?.retrievalMode ?? (hasHybridConfig() ? "hybrid_rrf_rerank" : "keyword_only");
  const response = Response.json({ query, retrievalMode, degraded, results:results.slice(0, 6), latency_ms:Date.now() - started, rate_limit_remaining:rate.remaining, configured:{ vector:hasHybridConfig(), reranker:Boolean(process.env.DASHSCOPE_RERANK_URL) } });
  if (identity.isNew) response.headers.append("set-cookie", `chainscope_visitor=${identity.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
  return response;
}
