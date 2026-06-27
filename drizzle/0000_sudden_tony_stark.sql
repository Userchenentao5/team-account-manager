CREATE TABLE `currency` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`minor_unit` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_channel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `space` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`payment_channel_id` integer NOT NULL,
	`currency_code` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`period_unit` text,
	`period_count` integer,
	`rate_used` text,
	`rate_as_of` text,
	`rate_source` text,
	`amount_usd` integer,
	`opening_date` text,
	`expiry_date` text,
	FOREIGN KEY (`payment_channel_id`) REFERENCES `payment_channel`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`currency_code`) REFERENCES `currency`(`code`) ON UPDATE no action ON DELETE no action
);
