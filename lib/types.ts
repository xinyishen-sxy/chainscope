export type Topic = "foundation" | "contract_security" | "interoperability" | "lab";
export type SourceStatus = "discovered" | "pending_review" | "approved" | "indexing" | "published" | "rejected" | "failed" | "archived";
export type SourceType = "official_docs" | "paper" | "lab_project";
export type SourceCollection = "official" | "lab" | "high_impact";

export interface Source {
  id: string;
  title: string;
  url: string;
  topic: Topic;
  type: SourceType;
  authors: string[];
  year: number;
  license: string;
  status: SourceStatus;
  lastSyncedAt: string;
  doi?: string;
  abstract?: string;
  collection?: SourceCollection;
  citedByCount?: number;
  citationProvider?: "Semantic Scholar" | "OpenAlex" | "publisher";
  orcid?: string;
  openAccessUrl?: string;
  contentScope?: "metadata" | "abstract" | "open_fulltext";
  fulltextStatus?: "metadata_only" | "abstract_indexed" | "fulltext_indexed" | "failed";
  syncError?: string;
}

export interface Citation {
  chunkId: string;
  sourceId: string;
  title: string;
  url: string;
  section: string;
  authors: string[];
  year: number;
  quote: string;
  score: number;
}

export interface SearchResult {
  chunkId: string;
  sourceId: string;
  title: string;
  url: string;
  section: string;
  snippet: string;
  topic: Topic;
  sourceType: SourceType;
  authors?: string[];
  year: number;
  scores: { vector: number; keyword: number; fusion: number; rerank: number };
  language?: "zh" | "en";
  pageNumber?: number;
  retrievalMode?: "hybrid_rrf_rerank" | "hybrid_rrf" | "vector_only" | "keyword_only" | "demo_fallback";
}

export interface Answer {
  mode: "generated" | "retrieval_only" | "refusal";
  answer: string;
  language: "zh" | "en";
  citations: Citation[];
  confidence: number;
  warnings: string[];
  latency_ms: number;
  retrieval_latency_ms?: number;
  generation_latency_ms?: number;
  quota?: { remaining: number; limit: number; resetsAt: string };
}

export interface EvaluationRun {
  version: string;
  runAt: string;
  datasetSize: number;
  metrics: {
    recallAt5: number;
    ndcgAt10: number;
    mrr: number;
    citationAccuracy: number;
    citationCoverage: number;
    faithfulness: number;
    refusalF1: number;
    searchP95Ms: number;
    generationP95Ms: number;
  };
  comparisons: { method: string; ndcgAt10: number; latencyP95Ms: number }[];
  state?: "not_run" | "completed";
  passed?: boolean;
  notes?: string;
}
