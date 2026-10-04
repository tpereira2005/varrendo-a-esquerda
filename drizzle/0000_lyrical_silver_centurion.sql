CREATE TABLE `collector` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`cycle_started_at` integer DEFAULT 0 NOT NULL,
	`cycle_finished_at` integer DEFAULT 0 NOT NULL,
	`next_at` integer DEFAULT 0 NOT NULL,
	`pause_until` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`payload` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`at` integer NOT NULL,
	`corrected_at` integer
);
--> statement-breakpoint
CREATE TABLE `results` (
	`key` text PRIMARY KEY NOT NULL,
	`uf` text NOT NULL,
	`cargo` integer NOT NULL,
	`url` text NOT NULL,
	`body` text,
	`parsed` text,
	`hash` text,
	`etag` text,
	`modified` text,
	`generated_at` integer,
	`checked_at` integer DEFAULT 0 NOT NULL,
	`success_at` integer DEFAULT 0 NOT NULL,
	`error` text,
	`failures` integer DEFAULT 0 NOT NULL,
	`retry_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`hash` text NOT NULL,
	`parsed` text NOT NULL,
	`at` integer NOT NULL
);
