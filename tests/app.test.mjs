import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
test("ships ChainScope product metadata and removes starter preview", async () => {
  const [page, layout, app, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"), readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/chainscope-app.tsx", root), "utf8"), readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(page, /ChainScopeApp/); assert.match(layout, /链知 ChainScope/); assert.match(app, /知识问答/);
  assert.doesNotMatch(page + layout, /codex-preview|SkeletonPreview/); assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("evaluation set contains the agreed 80 questions", async () => {
  const questions = JSON.parse(await readFile(new URL("evaluation/questions.json", root), "utf8"));
  assert.equal(questions.length, 80);
  assert.deepEqual(Object.fromEntries(["foundation","contract_security","interoperability","lab","unanswerable"].map(topic => [topic, questions.filter(q => q.topic === topic).length])), { foundation:15, contract_security:20, interoperability:20, lab:15, unanswerable:10 });
});

test("public and protected API surfaces exist", async () => {
  const paths = ["app/api/ask/route.ts","app/api/search/route.ts","app/api/sources/route.ts","app/api/evaluations/latest/route.ts","app/api/admin/sync/route.ts"];
  for (const path of paths) assert.ok((await readFile(new URL(path, root), "utf8")).length > 50);
});

test("implements real RAG providers, quota controls, and D1 FTS", async () => {
  const [providers, ask, quota, migration, env] = await Promise.all([
    readFile(new URL("lib/providers.ts", root), "utf8"), readFile(new URL("app/api/ask/route.ts", root), "utf8"),
    readFile(new URL("lib/quota.ts", root), "utf8"), readFile(new URL("drizzle/0001_real_rag.sql", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
  ]);
  assert.match(providers, /text-embedding-v4/); assert.match(providers, /qwen3-rerank/); assert.match(providers, /deepseek-v4-flash/);
  assert.match(providers, /reciprocalRankFusion/); assert.match(migration, /fts5/); assert.match(quota, /VISITOR_LIMIT = 5/);
  assert.match(ask, /retrieval_only/); assert.match(ask, /HttpOnly/); assert.match(env, /CLOUDFLARE_VECTORIZE_TOKEN/);
});

test("ships all forty ORCID records without committing secrets", async () => {
  const [demo, extra, env] = await Promise.all([readFile(new URL("lib/demo-data.ts", root), "utf8"), readFile(new URL("lib/lab-works.ts", root), "utf8"), readFile(new URL(".env.example", root), "utf8")]);
  const orcidSpecific = (demo.match(/orcid:\"0000-0001-5870-5730\"/g) ?? []).length;
  const extraWorks = (extra.match(/^\s*\[\"/gm) ?? []).length;
  assert.equal(orcidSpecific + extraWorks, 40);
  assert.doesNotMatch(env, /=sk-[A-Za-z0-9]/); assert.match(env, /DEEPSEEK_API_KEY=\r?\n/);
});
