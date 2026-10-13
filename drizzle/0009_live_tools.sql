CREATE TABLE `live_tools` (
	`user_id` varchar(36) NOT NULL,
	`state` json NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `live_tools_user_id` PRIMARY KEY(`user_id`)
);
