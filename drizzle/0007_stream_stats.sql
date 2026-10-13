CREATE TABLE `stream_stats` (
	`user_id` varchar(36) NOT NULL,
	`state` json NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `stream_stats_user_id` PRIMARY KEY(`user_id`)
);
