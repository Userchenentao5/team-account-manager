ALTER TABLE `child_account` ADD `billing_period_unit` text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE `child_account` ADD `billing_period_count` integer DEFAULT 1 NOT NULL;