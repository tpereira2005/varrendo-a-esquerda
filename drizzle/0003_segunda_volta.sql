CREATE TABLE `rounds` (
	`turn` integer PRIMARY KEY NOT NULL,
	`federal` integer NOT NULL,
	`estadual` integer NOT NULL,
	`confirmed_at` integer,
	`checked_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timeline` (
	`key` text NOT NULL,
	`generated_at` integer NOT NULL,
	`at` integer NOT NULL,
	`pct_sections` real NOT NULL,
	`votes_a` integer NOT NULL,
	`votes_b` integer NOT NULL,
	PRIMARY KEY(`key`, `generated_at`)
);
--> statement-breakpoint
ALTER TABLE `notices` ADD `turn` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `results` ADD `turn` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `revisions` ADD `turn` integer DEFAULT 1 NOT NULL;