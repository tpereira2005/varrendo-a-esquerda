ALTER TABLE `results` ADD `summary` text;
--> statement-breakpoint
UPDATE results SET summary=json_remove(parsed,'$.candidates','$.events') WHERE parsed IS NOT NULL;
