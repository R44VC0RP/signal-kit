CREATE TABLE `overlays` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`type` varchar(16) NOT NULL,
	`name` varchar(80) NOT NULL,
	`settings` json NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`token_encrypted` text NOT NULL,
	`last_seen_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `overlays_id` PRIMARY KEY(`id`),
	CONSTRAINT `overlays_token_hash_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `overlays_user_id_idx` ON `overlays` (`user_id`);