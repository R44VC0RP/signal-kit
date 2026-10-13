CREATE TABLE `bot_configs` (
	`user_id` varchar(36) NOT NULL,
	`config` json NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `bot_configs_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty` (
	`user_id` varchar(36) NOT NULL,
	`platform` varchar(16) NOT NULL,
	`chatter_id` varchar(128) NOT NULL,
	`name` varchar(128) NOT NULL,
	`points` int NOT NULL DEFAULT 0,
	`watch_minutes` int NOT NULL DEFAULT 0,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `loyalty_user_id_platform_chatter_id_pk` PRIMARY KEY(`user_id`,`platform`,`chatter_id`)
);
--> statement-breakpoint
CREATE INDEX `loyalty_user_points_idx` ON `loyalty` (`user_id`,`points`);