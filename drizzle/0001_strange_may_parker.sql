CREATE TABLE `connected_accounts` (
	`id` varchar(64) NOT NULL,
	`owner_twitch_user_id` varchar(64) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`provider_account_id` varchar(128) NOT NULL,
	`login` varchar(128) NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`profile_image_url` text,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text NOT NULL,
	`token_expires_at` timestamp,
	`scopes` json NOT NULL,
	`last_sync_at` timestamp,
	`last_event_at` timestamp,
	`last_error` text,
	`connected_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connected_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `connected_accounts_unique_provider_account_idx` UNIQUE(`owner_twitch_user_id`,`provider`,`provider_account_id`)
);
--> statement-breakpoint
ALTER TABLE `connected_accounts` ADD CONSTRAINT `connected_accounts_owner_twitch_user_id_twitch_users_id_fk` FOREIGN KEY (`owner_twitch_user_id`) REFERENCES `twitch_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `connected_accounts_owner_idx` ON `connected_accounts` (`owner_twitch_user_id`);--> statement-breakpoint
CREATE INDEX `connected_accounts_provider_idx` ON `connected_accounts` (`provider`);