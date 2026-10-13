CREATE TABLE `user_settings` (
	`user_id` varchar(36) NOT NULL,
	`discord_webhook` text,
	`discord_live` boolean NOT NULL DEFAULT true,
	`discord_recap` boolean NOT NULL DEFAULT true,
	`public_slug` varchar(40),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `user_settings_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `user_settings_public_slug_unique` UNIQUE(`public_slug`)
);
