CREATE TABLE `exterior` (
	`turn` integer NOT NULL,
	`cd` text NOT NULL,
	`want` text,
	`stamp` text,
	`parsed` text,
	`checked_at` integer DEFAULT 0 NOT NULL,
	`error` text,
	PRIMARY KEY(`turn`, `cd`)
);
