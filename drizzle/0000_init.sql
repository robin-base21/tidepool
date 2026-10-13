CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_account` text NOT NULL,
	`source_id` text NOT NULL,
	`source_url` text NOT NULL,
	`source_posted_at` text NOT NULL,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text,
	`location` text,
	`summary` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_source_source_id_unique` ON `posts` (`source`,`source_id`);--> statement-breakpoint
CREATE INDEX `posts_start_instant_id_idx` ON `posts` (unixepoch("start"),`id`);--> statement-breakpoint
CREATE INDEX `posts_source_account_idx` ON `posts` (`source_account`);--> statement-breakpoint
CREATE INDEX `posts_updated_at_idx` ON `posts` (`updated_at`);