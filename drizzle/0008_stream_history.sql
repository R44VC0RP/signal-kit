CREATE TABLE `chatters` (
	`user_id` varchar(36) NOT NULL,
	`platform` varchar(16) NOT NULL,
	`chatter_id` varchar(128) NOT NULL,
	`name` varchar(128) NOT NULL,
	`messages` int NOT NULL DEFAULT 0,
	`streams` int NOT NULL DEFAULT 0,
	`first_seen_at` timestamp(3) NOT NULL,
	`last_seen_at` timestamp(3) NOT NULL,
	CONSTRAINT `chatters_user_id_platform_chatter_id_pk` PRIMARY KEY(`user_id`,`platform`,`chatter_id`)
);
--> statement-breakpoint
CREATE TABLE `stream_chatters` (
	`stream_id` varchar(36) NOT NULL,
	`platform` varchar(16) NOT NULL,
	`chatter_id` varchar(128) NOT NULL,
	`name` varchar(128) NOT NULL,
	`messages` int NOT NULL DEFAULT 0,
	`first_at` timestamp(3) NOT NULL,
	`last_at` timestamp(3) NOT NULL,
	CONSTRAINT `stream_chatters_stream_id_platform_chatter_id_pk` PRIMARY KEY(`stream_id`,`platform`,`chatter_id`)
);
--> statement-breakpoint
CREATE TABLE `streams` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`started_at` timestamp(3) NOT NULL,
	`ended_at` timestamp(3),
	`title` varchar(300),
	`summary` json NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `streams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chatters_user_messages_idx` ON `chatters` (`user_id`,`messages`);--> statement-breakpoint
CREATE INDEX `stream_chatters_messages_idx` ON `stream_chatters` (`stream_id`,`messages`);--> statement-breakpoint
CREATE INDEX `streams_user_started_idx` ON `streams` (`user_id`,`started_at`);