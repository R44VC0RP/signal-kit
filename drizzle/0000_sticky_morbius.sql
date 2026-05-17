CREATE TABLE `app_sessions` (
	`id` varchar(128) NOT NULL,
	`twitch_user_id` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_subscriptions` (
	`id` varchar(64) NOT NULL,
	`twitch_user_id` varchar(64) NOT NULL,
	`type` varchar(128) NOT NULL,
	`version` varchar(16) NOT NULL,
	`condition_hash` varchar(64) NOT NULL,
	`condition_json` json NOT NULL,
	`required_scopes` json NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT 'desired',
	`twitch_subscription_id` varchar(128),
	`twitch_session_id` varchar(128),
	`error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_subscriptions_unique_desired_idx` UNIQUE(`twitch_user_id`,`type`,`version`,`condition_hash`)
);
--> statement-breakpoint
CREATE TABLE `overlay_tokens` (
	`id` varchar(64) NOT NULL,
	`twitch_user_id` varchar(64) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`last_used_at` timestamp,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `overlay_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `overlay_tokens_token_hash_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `twitch_users` (
	`id` varchar(64) NOT NULL,
	`login` varchar(128) NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`email` varchar(255),
	`profile_image_url` text,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text NOT NULL,
	`token_expires_at` timestamp,
	`scopes` json NOT NULL,
	`connected_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `twitch_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `app_sessions` ADD CONSTRAINT `app_sessions_twitch_user_id_twitch_users_id_fk` FOREIGN KEY (`twitch_user_id`) REFERENCES `twitch_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_subscriptions` ADD CONSTRAINT `event_subscriptions_twitch_user_id_twitch_users_id_fk` FOREIGN KEY (`twitch_user_id`) REFERENCES `twitch_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `overlay_tokens` ADD CONSTRAINT `overlay_tokens_twitch_user_id_twitch_users_id_fk` FOREIGN KEY (`twitch_user_id`) REFERENCES `twitch_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `app_sessions_user_idx` ON `app_sessions` (`twitch_user_id`);--> statement-breakpoint
CREATE INDEX `event_subscriptions_user_idx` ON `event_subscriptions` (`twitch_user_id`);--> statement-breakpoint
CREATE INDEX `overlay_tokens_user_idx` ON `overlay_tokens` (`twitch_user_id`);