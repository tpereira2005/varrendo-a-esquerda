CREATE TABLE `mercado` (
	`id` integer PRIMARY KEY NOT NULL,
	`payload` text,
	`recent` text,
	`campaign` text,
	`campaign_at` integer DEFAULT 0 NOT NULL,
	`checked_at` integer DEFAULT 0 NOT NULL,
	`success_at` integer,
	`error` text
);
