CREATE TABLE `seen_posts` (
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`outcome` text NOT NULL,
	`seen_at` text NOT NULL,
	PRIMARY KEY(`source`, `source_id`)
);
--> statement-breakpoint
-- Posts imported before seen-tracking existed were all classified as events.
INSERT INTO `seen_posts` (`source`, `source_id`, `outcome`, `seen_at`)
SELECT `source`, `source_id`, 'event', `created_at` FROM `posts`;
