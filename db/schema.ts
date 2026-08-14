import { integer, real, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  canonicalUrl: text("canonical_url").notNull(),
  doi: text("doi"), title: text("title").notNull(), topic: text("topic").notNull(),
  sourceType: text("source_type").notNull(), authorsJson: text("authors_json").notNull().default("[]"),
  publicationYear: integer("publication_year").notNull(), license: text("license").notNull(),
  status: text("status").notNull().default("discovered"), contentHash: text("content_hash"),
  openAccessUrl: text("open_access_url"), contentScope: text("content_scope").notNull().default("metadata"),
  fulltextStatus: text("fulltext_status").notNull().default("metadata_only"), syncError: text("sync_error"),
  collection: text("collection").notNull().default("official"), orcid: text("orcid"),
  citedByCount: integer("cited_by_count"), citationProvider: text("citation_provider"), abstract: text("abstract"),
  lastSyncedAt: text("last_synced_at").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_sources_canonical_url").on(table.canonicalUrl), uniqueIndex("idx_sources_doi").on(table.doi), index("idx_sources_status_topic").on(table.status, table.topic)]);

export const chunks = sqliteTable("chunks", {
  id: text("id").primaryKey(), sourceId: text("source_id").notNull().references(() => sources.id, { onDelete:"cascade" }),
  section: text("section").notNull(), content: text("content").notNull(), tokenCount: integer("token_count").notNull(),
  ordinal: integer("ordinal").notNull(), vectorId: text("vector_id"), createdAt: text("created_at").notNull(),
  language: text("language").notNull().default("en"), pageNumber: integer("page_number"),
  contentHash: text("content_hash"), vectorVersion: text("vector_version"),
}, (table) => [index("idx_chunks_source_ordinal").on(table.sourceId, table.ordinal)]);

export const syncJobs = sqliteTable("sync_jobs", {
  id: text("id").primaryKey(), status: text("status").notNull(), discovered: integer("discovered").notNull().default(0),
  published: integer("published").notNull().default(0), failed: integer("failed").notNull().default(0),
  error: text("error"), startedAt: text("started_at").notNull(), finishedAt: text("finished_at"),
}, (table) => [index("idx_sync_jobs_status_started").on(table.status, table.startedAt)]);

export const evaluationRuns = sqliteTable("evaluation_runs", {
  id: text("id").primaryKey(), version: text("version").notNull(), datasetSize: integer("dataset_size").notNull(),
  metricsJson: text("metrics_json").notNull(), passed: integer("passed", { mode:"boolean" }).notNull(),
  runAt: text("run_at").notNull(), notes: text("notes"),
}, (table) => [index("idx_evaluation_runs_run_at").on(table.runAt)]);

export const relevanceJudgments = sqliteTable("relevance_judgments", {
  id: text("id").primaryKey(), evaluationRunId: text("evaluation_run_id").notNull().references(() => evaluationRuns.id, { onDelete:"cascade" }),
  questionId: text("question_id").notNull(), chunkId: text("chunk_id"), relevant: integer("relevant", { mode:"boolean" }).notNull(), score: real("score"),
});

export const visitorUsage = sqliteTable("visitor_usage", {
  visitorHash: text("visitor_hash").notNull(), day: text("day").notNull(),
  generatedCount: integer("generated_count").notNull().default(0), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_visitor_usage_hash_day").on(table.visitorHash, table.day)]);

export const globalUsage = sqliteTable("global_usage", {
  day: text("day").primaryKey(), generatedCount: integer("generated_count").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0), outputTokens: integer("output_tokens").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const ragRequests = sqliteTable("rag_requests", {
  id: text("id").primaryKey(), visitorHash: text("visitor_hash").notNull(), mode: text("mode").notNull(),
  status: text("status").notNull(), retrievalMode: text("retrieval_mode").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0), outputTokens: integer("output_tokens").notNull().default(0),
  latencyMs: integer("latency_ms").notNull(), createdAt: text("created_at").notNull(), errorCode: text("error_code"),
}, (table) => [index("idx_rag_requests_created_at").on(table.createdAt)]);

export const rateLimitEvents = sqliteTable("rate_limit_events", {
  visitorHash: text("visitor_hash").notNull(), minuteBucket: text("minute_bucket").notNull(),
  requestCount: integer("request_count").notNull().default(0), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_rate_limit_events_hash_minute").on(table.visitorHash, table.minuteBucket)]);
