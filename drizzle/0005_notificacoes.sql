CREATE TABLE `push_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subs` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_ok` integer,
	`failures` integer DEFAULT 0 NOT NULL
);
