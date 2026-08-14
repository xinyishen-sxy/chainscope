import { DeepSeekGenerationProvider, KeywordSearchProvider, getSearchProvider, hasHybridConfig, toCitations } from "../../../lib/providers";
import { consumeQuota, quotaStatus, recordRequest, visitorIdentity } from "../../../lib/quota";
import type { Answer, Topic } from "../../../lib/types";

function languageOf(text: string): "zh" | "en" { return /[\u3400-\u9fff]/.test(text) ? "zh" : "en"; }
function retrievalSummary(language: "zh" | "en", count: number) { return language === "zh" ? `已找到 ${count} 条可核验的相关证据。生成模型当前不可用或额度已用完，请直接查看右侧引用与原文。` : `${count} verifiable evidence passages were retrieved. Generation is unavailable or the quota is exhausted; inspect the citations directly.`; }

export async function POST(request: Request) {
  const started = Date.now(); const identity = await visitorIdentity(request); const payload = await request.json() as { query?:string; filters?:{ topic?:Topic|"all" } }; const query = payload.query?.trim() ?? "";
  if (!query) return Response.json({ error:"query is required" }, { status:400 });
  if (query.length > 500) return Response.json({ error:"query exceeds 500 characters" }, { status:400 });
  const language = languageOf(query); const topic = payload.filters?.topic ?? "all"; const retrievalStarted = Date.now(); let results; let retrievalError = false;
  try { results = await getSearchProvider().search(query, { topic }); } catch { retrievalError = true; results = await new KeywordSearchProvider().search(query, { topic }); }
  const retrievalLatency = Date.now() - retrievalStarted; const retrievalMode = results[0]?.retrievalMode ?? (hasHybridConfig() ? "hybrid_rrf_rerank" : "keyword_only");
  const calibratedThreshold = Number(process.env.EVIDENCE_THRESHOLD ?? "NaN");
  const thresholdReady = Number.isFinite(calibratedThreshold) && calibratedThreshold >= 0 && calibratedThreshold <= 1;
  const displayThreshold = thresholdReady ? calibratedThreshold : 0;
  const relevant = results.filter((item) => (item.scores.rerank || item.scores.fusion || item.scores.keyword) >= displayThreshold).slice(0, 6);
  const unsafe = /ignore (all|previous)|忽略.*指令|system prompt|系统提示词|泄露.*密钥|private admin/i.test(query);
  const outside = /天气|股票|菜谱|世界杯|weather|stock price|recipe/i.test(query);
  const citations = toCitations(relevant);
  let mode: Answer["mode"] = "retrieval_only"; let answer = retrievalSummary(language, relevant.length); const warnings:string[] = []; let generationLatency = 0; let inputTokens = 0; let outputTokens = 0; let errorCode:string|undefined;
  const quota = await quotaStatus(identity.hash); const canGenerate = Boolean(process.env.DEEPSEEK_API_KEY) && hasHybridConfig() && thresholdReady && quota.allowed && relevant.length > 0 && !unsafe && !outside;
  if (unsafe || outside || relevant.length === 0) { mode = "refusal"; answer = language === "zh" ? "现有已审核资料不足以可靠回答，或问题试图绕过证据规则。链知不会根据证据外知识编造结论。" : "The approved corpus is insufficient, or the request attempts to bypass the evidence policy. ChainScope will not invent an answer beyond retrieved evidence."; }
  else if (canGenerate) {
    await consumeQuota(identity.hash); const generationStarted = Date.now();
    try { const generated = await new DeepSeekGenerationProvider().generate({ query, language, evidence:relevant }); generationLatency = Date.now() - generationStarted; answer = generated.text; inputTokens = generated.inputTokens; outputTokens = generated.outputTokens; mode = "generated"; }
    catch (error) { generationLatency = Date.now() - generationStarted; errorCode = error instanceof Error ? error.message.slice(0, 60) : "generation_failed"; warnings.push("生成服务暂时不可用，已降级为真实检索证据。"); }
  } else if (!process.env.DEEPSEEK_API_KEY || !hasHybridConfig()) warnings.push("外部模型或向量服务尚未配置，当前仅返回可核验检索证据。");
  else if (!thresholdReady) warnings.push("证据阈值尚未通过固定评测集校准，已停止生成并仅返回检索证据。");
  else if (!quota.allowed) warnings.push(`今日生成额度已用完，${quota.resetsAt} 后重置；检索与引用仍可用。`);
  if (retrievalError) warnings.push("向量或重排服务异常，已降级为 D1 真实关键词检索。");
  const currentQuota = await quotaStatus(identity.hash); const latency = Date.now() - started;
  await recordRequest({ visitorHash:identity.hash, mode, status:errorCode ? "degraded" : "ok", retrievalMode, inputTokens, outputTokens, latencyMs:latency, errorCode });
  const response = Response.json({ mode, answer, language, citations, confidence:mode === "refusal" ? .2 : Math.min(.96, relevant[0]?.scores.rerank || relevant[0]?.scores.fusion || relevant[0]?.scores.keyword || 0), warnings, latency_ms:latency, retrieval_latency_ms:retrievalLatency, generation_latency_ms:generationLatency, quota:{ remaining:currentQuota.remaining, limit:currentQuota.limit, resetsAt:currentQuota.resetsAt } } satisfies Answer);
  if (identity.isNew) response.headers.append("set-cookie", `chainscope_visitor=${identity.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
  return response;
}
