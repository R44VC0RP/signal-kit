CREATE TABLE `app_settings` (
	`key` varchar(64) NOT NULL,
	`value` text NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` varchar(26) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`connection_id` varchar(36) NOT NULL,
	`platform` varchar(16) NOT NULL,
	`kind` varchar(48) NOT NULL,
	`source_id` varchar(191) NOT NULL,
	`envelope` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_source_idx` UNIQUE(`platform`,`source_id`)
);
--> statement-breakpoint
CREATE INDEX `events_user_id_idx` ON `events` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `events_created_at_idx` ON `events` (`created_at`);