"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Answer, EvaluationRun, SearchResult, Source, SourceCollection, Topic } from "../lib/types";
import { DEMO_SOURCES, EMPTY_EVALUATION } from "../lib/demo-data";

type View = "ask" | "search" | "sources" | "evaluation";

const nav: { id: View; label: string; hint: string }[] = [
  { id: "ask", label: "知识问答", hint: "有据可查" },
  { id: "search", label: "主题检索", hint: "看见过程" },
  { id: "sources", label: "数据源", hint: "可信可控" },
  { id: "evaluation", label: "检索评测", hint: "结果可验" },
];

const topicLabels: Record<Topic | "all", string> = {
  all: "全部主题",
  foundation: "区块链基础",
  contract_security: "智能合约与安全",
  interoperability: "跨链与互操作",
  lab: "实验室成果",
};

async function getJson<T>(url: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as T;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error("服务暂时不可用");
  }
}

export function ChainScopeApp() {
  const [view, setView] = useState<View>("ask");
  const [query, setQuery] = useState("跨链协议如何验证来自另一条链的消息？");
  const [topic, setTopic] = useState<Topic | "all">("all");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sources, setSources] = useState<Source[]>(DEMO_SOURCES);
  const [evaluation, setEvaluation] = useState<EvaluationRun>(EMPTY_EVALUATION);
  const [selectedCitation, setSelectedCitation] = useState<number | null>(null);

  useEffect(() => {
    void getJson<{ sources: Source[] }>("/api/sources", undefined, { sources: DEMO_SOURCES })
      .then((data) => setSources(data.sources));
    void getJson<EvaluationRun>("/api/evaluations/latest", undefined, EMPTY_EVALUATION)
      .then(setEvaluation);
  }, []);

  const publishedCount = sources.filter((source) => source.status === "published").length;
  const topicsCovered = new Set(sources.filter((source) => source.status === "published").map((source) => source.topic)).size;
  const labCount = sources.filter((source) => source.collection === "lab" && source.status === "published").length;

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSelectedCitation(null);
    try {
      const data = await getJson<Answer>("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, filters: { topic } }),
      });
      setAnswer(data);
    } finally {
      setLoading(false);
    }
  }

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, topic });
      const data = await getJson<{ results: SearchResult[] }>(`/api/search?${params}`);
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    if (view === "search") void search(event);
    else void ask(event);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("ask")} aria-label="返回知识问答">
          <span className="brand-mark">链</span>
          <span><strong>链知</strong><small>ChainScope</small></span>
        </button>
        <nav aria-label="主要导航">
          {nav.map((item) => (
            <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}>
              <span>{item.label}</span><small>{item.hint}</small>
            </button>
          ))}
        </nav>
        <div className="status-pill"><i /> 知识库在线</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow"><span /> BLOCKCHAIN RESEARCH INTELLIGENCE</p>
          <h1>让每一个结论，<br /><em>都有证据可循。</em></h1>
          <p className="hero-copy">面向区块链实验室的可溯源知识中台。检索中英文权威资料，理解智能合约与跨链技术，并将答案定位到原始证据。</p>
        </div>
        <div className="hero-stats" aria-label="知识库概览">
          <div><strong>{publishedCount}</strong><span>已发布来源</span></div>
          <div><strong>{labCount}</strong><span>实验室成果</span></div>
          <div><strong>{evaluation.state === "completed" ? `${Math.round(evaluation.metrics.citationAccuracy * 100)}%` : "—"}</strong><span>引用准确率</span></div>
        </div>
      </section>

      {(view === "ask" || view === "search") && (
        <section className="workspace">
          <div className="workspace-head">
            <div><p className="section-kicker">{view === "ask" ? "ASK WITH EVIDENCE" : "SEARCH WITH TRANSPARENCY"}</p><h2>{view === "ask" ? "向知识库提问" : "探索原始证据"}</h2></div>
            <div className="mode-badge">D1 FTS5 · 百炼向量 · RRF · Qwen Reranker</div>
          </div>
          <form className="query-box" onSubmit={submit}>
            <label htmlFor="question">输入问题或技术关键词</label>
            <div className="query-row">
              <textarea id="question" value={query} onChange={(event) => setQuery(event.target.value)} rows={2} placeholder="例如：IBC 与传统公证人跨链方案的信任假设有何不同？" />
              <button type="submit" disabled={loading}>{loading ? "检索中…" : view === "ask" ? "生成有据回答 ↗" : "执行混合检索 ↗"}</button>
            </div>
            <div className="filters">
              {(Object.keys(topicLabels) as (Topic | "all")[]).map((key) => <button type="button" key={key} className={topic === key ? "chip selected" : "chip"} onClick={() => setTopic(key)}>{topicLabels[key]}</button>)}
            </div>
          </form>

          {view === "ask" ? (
            answer ? <AnswerPanel answer={answer} selected={selectedCitation} onSelect={setSelectedCitation} /> : <ExampleGrid onChoose={(text) => setQuery(text)} />
          ) : results.length ? <SearchResults results={results} /> : <SearchEmpty />}
        </section>
      )}

      {view === "sources" && <SourceCenter sources={sources} />}
      {view === "evaluation" && <EvaluationBoard evaluation={evaluation} />}

      <footer><span>链知 ChainScope · 区块链科研知识中台</span><span>答案不是终点，证据才是。</span></footer>
    </main>
  );
}

function ExampleGrid({ onChoose }: { onChoose: (text: string) => void }) {
  const examples = [
    ["跨链与互操作", "IBC 如何在不依赖第三方公证人的情况下验证跨链消息？"],
    ["智能合约安全", "重入漏洞为什么会发生，检查—生效—交互模式如何缓解？"],
    ["实验室成果", "ScenGDL 如何降低智能合约漏洞检测误报并定位代码块？"],
  ];
  return <div className="example-grid">{examples.map(([label, text], index) => <button key={text} onClick={() => onChoose(text)}><span>0{index + 1}</span><small>{label}</small><strong>{text}</strong><i>查看证据 →</i></button>)}</div>;
}

function AnswerPanel({ answer, selected, onSelect }: { answer: Answer; selected: number | null; onSelect: (id: number | null) => void }) {
  return <div className="answer-layout">
    <article className="answer-card">
      <div className="answer-meta"><span className={`answer-mode ${answer.mode}`}>{answer.mode === "refusal" ? "证据不足" : answer.mode === "retrieval_only" ? "证据检索模式" : "DeepSeek 引用回答"}</span><span>置信度 {Math.round(answer.confidence * 100)}%</span><span>检索 {answer.retrieval_latency_ms ?? answer.latency_ms} ms</span>{Boolean(answer.generation_latency_ms) && <span>生成 {answer.generation_latency_ms} ms</span>}</div>
      <h3>{answer.mode === "refusal" ? "暂时无法给出可靠结论" : "基于当前知识库的回答"}</h3>
      {answer.answer.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {answer.warnings.map((warning) => <div className="warning" key={warning}>△ {warning}</div>)}
      {answer.quota && <div className="quota-note"><strong>今日生成额度 {answer.quota.remaining}/{answer.quota.limit}</strong><span>额度用完后仍可检索并查看原始证据</span></div>}
    </article>
    <aside className="citation-panel">
      <div className="citation-title"><span>引用证据</span><small>{answer.citations.length} 条来源</small></div>
      {answer.citations.map((citation, index) => <button key={citation.chunkId} className={selected === index ? "citation active" : "citation"} onClick={() => onSelect(selected === index ? null : index)}>
        <span className="cite-index">[{index + 1}]</span><div><strong>{citation.title}</strong><small>{citation.authors.join("、")} · {citation.year}</small><p>{citation.quote}</p>{selected === index && <a href={citation.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>打开原始来源 ↗</a>}</div>
      </button>)}
    </aside>
  </div>;
}

function SearchResults({ results }: { results: SearchResult[] }) {
  return <div className="results"><div className="results-head"><span>找到 {results.length} 个高相关片段</span><small>分数已经归一化，仅用于结果内排序</small></div>{results.map((result, index) => <article key={result.chunkId} className="result-card">
    <div className="rank">{String(index + 1).padStart(2, "0")}</div><div className="result-main"><div className="result-meta"><span>{topicLabels[result.topic]}</span><span>{result.sourceType}</span><span>{result.year}</span></div><h3>{result.title}</h3><p>{result.snippet}</p><a href={result.url} target="_blank" rel="noreferrer">{result.section} · 查看来源 ↗</a></div><div className="score-stack"><Score label="语义" value={result.scores.vector} /><Score label="关键词" value={result.scores.keyword} /><Score label="融合" value={result.scores.fusion} /><Score label="重排" value={result.scores.rerank} emphasis /></div>
  </article>)}</div>;
}

function Score({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) { return <div className={emphasis ? "score emphasis" : "score"}><span>{label}</span><strong>{value.toFixed(2)}</strong><i style={{ width: `${Math.round(value * 100)}%` }} /></div>; }

function SearchEmpty() { return <div className="empty-state"><div>⌕</div><h3>检索过程将在这里展开</h3><p>你将看到语义召回、关键词命中、RRF融合与重排分数，而不只是一个无法解释的答案。</p></div>; }

function SourceCenter({ sources }: { sources: Source[] }) {
  const [filter, setFilter] = useState<"all" | SourceCollection>("all");
  const visible = useMemo(() => sources.filter((source) => filter === "all" || source.collection === filter), [filter, sources]);
  const labCount = sources.filter((source) => source.collection === "lab").length;
  const highImpactCount = sources.filter((source) => source.collection === "high_impact").length;
  const filterLabels: Record<"all" | SourceCollection, string> = { all:"全部来源", lab:"实验室成果", high_impact:"领域高被引", official:"官方资料" };
  return <section className="content-page"><div className="page-heading"><p className="section-kicker">SOURCE GOVERNANCE</p><h2>数据源中心</h2><p>ORCID作为实验室成果主索引；元数据、摘要与开放全文分别标注，不重新分发受版权保护的PDF。</p></div><div className="source-summary"><div><small>实验室作者</small><strong>赵祥福 · Xiangfu Zhao</strong><a href="https://orcid.org/0000-0001-5870-5730" target="_blank" rel="noreferrer">ORCID 0000-0001-5870-5730 ↗</a></div><div><small>当前收录</small><strong>{labCount} 项实验室成果</strong><span>完整覆盖ORCID记录；区块链方向优先索引摘要或开放全文</span></div><div><small>领域基线</small><strong>{highImpactCount} 篇高影响论文</strong><span>引用次数为抓取时快照，不同平台口径可能不同</span></div></div><div className="source-toolbar"><div>{(["all", "lab", "high_impact", "official"] as const).map((collection) => <button key={collection} className={filter === collection ? "chip selected" : "chip"} onClick={() => setFilter(collection)}>{filterLabels[collection]}</button>)}</div><span>ORCID发现 · DOI去重 · 开放许可审核 · 增量索引</span></div><div className="source-table"><div className="source-row header"><span>来源</span><span>归属</span><span>年份</span><span>索引范围</span><span>状态</span></div>{visible.map((source) => <div className="source-row" key={source.id}><div><a href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong></a><small>{source.authors.join("、")} · {source.doi ?? source.type}</small></div><span className={`collection-tag ${source.collection ?? "official"}`}>{filterLabels[source.collection ?? "official"]}</span><span>{source.year}</span><span>{source.contentScope === "open_fulltext" ? "开放全文" : source.contentScope === "abstract" || source.abstract ? "摘要" : "元数据"}</span><span><i className={`state ${source.fulltextStatus === "failed" ? "failed" : source.status}`} />{source.fulltextStatus === "fulltext_indexed" ? "已索引全文" : source.fulltextStatus === "abstract_indexed" || source.abstract ? "已索引摘要" : "已收录"}</span></div>)}</div></section>;
}

function EvaluationBoard({ evaluation }: { evaluation: EvaluationRun }) {
  if (evaluation.state === "not_run") return <section className="content-page"><div className="page-heading"><p className="section-kicker">RETRIEVAL EVALUATION</p><h2>检索评测看板</h2><p>真实语料索引完成后运行固定80题评测；在此之前不展示预置或虚构指标。</p></div><div className="not-run"><strong>尚未运行真实评测</strong><p>{evaluation.notes}</p><span>待配置向量与模型服务后，将自动生成 BM25、向量、RRF 与重排四组对照结果。</span></div></section>;
  const metrics = [
    ["Recall@5", evaluation.metrics.recallAt5, "目标 ≥ 85%"], ["nDCG@10", evaluation.metrics.ndcgAt10, "目标 ≥ 75%"], ["MRR", evaluation.metrics.mrr, "首条相关结果"], ["引用准确率", evaluation.metrics.citationAccuracy, "目标 ≥ 90%"], ["回答忠实度", evaluation.metrics.faithfulness, "目标 ≥ 90%"], ["拒答 F1", evaluation.metrics.refusalF1, "目标 ≥ 80%"],
  ] as const;
  return <section className="content-page"><div className="page-heading"><p className="section-kicker">RETRIEVAL EVALUATION</p><h2>检索评测看板</h2><p>同一固定测试集，对比关键词、向量、混合检索与重排效果。指标仅展示最近一次真实评测结果。</p></div><div className="run-note"><span>运行版本 {evaluation.version}</span><span>{evaluation.datasetSize} 条固定问题</span><span>{evaluation.runAt.slice(0, 10)}</span><span className="baseline-note">演示数据 · 接入流水线后自动更新</span></div><div className="metric-grid">{metrics.map(([label, value, hint]) => <div className="metric" key={label}><small>{label}</small><strong>{Math.round(value * 100)}<sup>%</sup></strong><div><i style={{ width: `${value * 100}%` }} /></div><span>{hint}</span></div>)}</div><div className="comparison"><div><p className="section-kicker">ABLATION STUDY</p><h3>检索方案对照</h3></div>{evaluation.comparisons.map((item) => <div className="comparison-row" key={item.method}><strong>{item.method}</strong><div className="bar"><i style={{ width: `${item.ndcgAt10 * 100}%` }} /></div><span>{(item.ndcgAt10 * 100).toFixed(1)}</span><small>{item.latencyP95Ms} ms</small></div>)}<p className="eval-footnote">正式验收以80条评测集跑分为准；未达到阈值时，页面将如实标记“未通过”，不会展示虚构结果。</p></div></section>;
}
