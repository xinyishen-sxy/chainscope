CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`section` text NOT NULL,
	`content` text NOT NULL,
	`token_count` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`vector_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chunks_source_ordinal` ON `chunks` (`source_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `evaluation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`dataset_size` integer NOT NULL,
	`metrics_json` text NOT NULL,
	`passed` integer NOT NULL,
	`run_at` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `idx_evaluation_runs_run_at` ON `evaluation_runs` (`run_at`);--> statement-breakpoint
CREATE TABLE `relevance_judgments` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_run_id` text NOT NULL,
	`question_id` text NOT NULL,
	`chunk_id` text,
	`relevant` integer NOT NULL,
	`score` real,
	FOREIGN KEY (`evaluation_run_id`) REFERENCES `evaluation_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_url` text NOT NULL,
	`doi` text,
	`title` text NOT NULL,
	`topic` text NOT NULL,
	`source_type` text NOT NULL,
	`authors_json` text DEFAULT '[]' NOT NULL,
	`publication_year` integer NOT NULL,
	`license` text NOT NULL,
	`status` text DEFAULT 'discovered' NOT NULL,
	`content_hash` text,
	`last_synced_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sources_canonical_url` ON `sources` (`canonical_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sources_doi` ON `sources` (`doi`);--> statement-breakpoint
CREATE INDEX `idx_sources_status_topic` ON `sources` (`status`,`topic`);--> statement-breakpoint
CREATE TABLE `sync_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`discovered` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_sync_jobs_status_started` ON `sync_jobs` (`status`,`started_at`);