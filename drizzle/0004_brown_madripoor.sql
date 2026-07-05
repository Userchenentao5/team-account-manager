CREATE TABLE `child_account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`space_id` integer NOT NULL,
	`seat_type` text DEFAULT 'codex' NOT NULL,
	`email` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`joined_date` text NOT NULL,
	`monthly_amount_minor` integer NOT NULL,
	`monthly_currency_code` text NOT NULL,
	`monthly_rate_used` text NOT NULL,
	`monthly_rate_as_of` text NOT NULL,
	`monthly_rate_source` text NOT NULL,
	`monthly_amount_usd` integer NOT NULL,
	`monthly_payment_day` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `space`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monthly_currency_code`) REFERENCES `currency`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `mother_account` ADD `seat_type` text DEFAULT 'codex' NOT NULL;--> statement-breakpoint
ALTER TABLE `mother_account` ADD `can_change_seat_type` integer DEFAULT true NOT NULL;