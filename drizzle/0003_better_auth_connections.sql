CREATE TABLE `accounts` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp(3),
	`refresh_token_expires_at` timestamp(3),
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_provider_account_idx` UNIQUE(`provider_id`,`account_id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` varchar(36) NOT NULL,
	`config_id` varchar(255) NOT NULL DEFAULT 'default',
	`name` text,
	`start` text,
	`reference_id` varchar(255) NOT NULL,
	`prefix` text,
	`key` varchar(255) NOT NULL,
	`refill_interval` int,
	`refill_amount` int,
	`last_refill_at` timestamp(3),
	`enabled` boolean DEFAULT true,
	`rate_limit_enabled` boolean DEFAULT true,
	`rate_limit_time_window` int DEFAULT 60000,
	`rate_limit_max` int DEFAULT 120,
	`request_count` int DEFAULT 0,
	`remaining` int,
	`last_request` timestamp(3),
	`expires_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`permissions` text,
	`metadata` text,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_key_idx` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`account_id` varchar(36) NOT NULL,
	`platform` varchar(16) NOT NULL,
	`platform_user_id` varchar(128) NOT NULL,
	`username` varchar(255) NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`avatar_url` text,
	`role` varchar(16) NOT NULL DEFAULT 'broadcaster',
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`status_reason` text,
	`scopes` json NOT NULL,
	`profile_synced_at` timestamp(3),
	`last_validated_at` timestamp(3),
	`last_event_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `connections_account_id_idx` UNIQUE(`account_id`),
	CONSTRAINT `connections_platform_user_idx` UNIQUE(`platform`,`platform_user_id`)
);
--> statement-breakpoint
CREATE TABLE `platform_subscriptions` (
	`id` varchar(36) NOT NULL,
	`connection_id` varchar(36) NOT NULL,
	`platform` varchar(16) NOT NULL,
	`type` varchar(128) NOT NULL,
	`version` varchar(16) NOT NULL,
	`condition_hash` varchar(64) NOT NULL,
	`condition_json` json NOT NULL,
	`required_scopes` json NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'desired',
	`remote_id` varchar(128),
	`transport_session_id` varchar(128),
	`error` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_subscriptions_unique_idx` UNIQUE(`connection_id`,`type`,`version`,`condition_hash`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `api_keys_config_id_idx` ON `api_keys` (`config_id`);--> statement-breakpoint
CREATE INDEX `api_keys_reference_id_idx` ON `api_keys` (`reference_id`);--> statement-breakpoint
CREATE INDEX `connections_user_id_idx` ON `connections` (`user_id`);--> statement-breakpoint
CREATE INDEX `platform_subscriptions_connection_idx` ON `platform_subscriptions` (`connection_id`);--> statement-breakpoint
CREATE INDEX `platform_subscriptions_remote_idx` ON `platform_subscriptions` (`remote_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);