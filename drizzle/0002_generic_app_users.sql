CREATE TABLE `app_users` (
	`id` varchar(64) NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`profile_image_url` text,
	`primary_provider` varchar(32) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `twitch_users` ADD COLUMN `app_user_id` varchar(64);--> statement-breakpoint
ALTER TABLE `app_sessions` ADD COLUMN `app_user_id` varchar(64);--> statement-breakpoint
ALTER TABLE `overlay_tokens` ADD COLUMN `app_user_id` varchar(64);--> statement-breakpoint
ALTER TABLE `connected_accounts` ADD COLUMN `app_user_id` varchar(64);--> statement-breakpoint
ALTER TABLE `app_sessions` MODIFY COLUMN `twitch_user_id` varchar(64);--> statement-breakpoint
ALTER TABLE `overlay_tokens` MODIFY COLUMN `twitch_user_id` varchar(64);--> statement-breakpoint
ALTER TABLE `connected_accounts` MODIFY COLUMN `owner_twitch_user_id` varchar(64);--> statement-breakpoint
INSERT INTO `app_users` (`id`, `display_name`, `profile_image_url`, `primary_provider`, `created_at`, `updated_at`)
SELECT `id`, `display_name`, `profile_image_url`, 'twitch', `connected_at`, `updated_at` FROM `twitch_users`
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`), `profile_image_url` = VALUES(`profile_image_url`), `updated_at` = VALUES(`updated_at`);--> statement-breakpoint
UPDATE `twitch_users` SET `app_user_id` = `id` WHERE `app_user_id` IS NULL;--> statement-breakpoint
UPDATE `app_sessions` SET `app_user_id` = `twitch_user_id` WHERE `app_user_id` IS NULL;--> statement-breakpoint
UPDATE `overlay_tokens` SET `app_user_id` = `twitch_user_id` WHERE `app_user_id` IS NULL;--> statement-breakpoint
UPDATE `connected_accounts` SET `app_user_id` = `owner_twitch_user_id` WHERE `app_user_id` IS NULL;--> statement-breakpoint
CREATE INDEX `twitch_users_app_user_idx` ON `twitch_users` (`app_user_id`);--> statement-breakpoint
CREATE INDEX `app_sessions_app_user_idx` ON `app_sessions` (`app_user_id`);--> statement-breakpoint
CREATE INDEX `overlay_tokens_app_user_idx` ON `overlay_tokens` (`app_user_id`);--> statement-breakpoint
CREATE INDEX `connected_accounts_app_user_idx` ON `connected_accounts` (`app_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `connected_accounts_unique_app_provider_idx` ON `connected_accounts` (`app_user_id`,`provider`);
