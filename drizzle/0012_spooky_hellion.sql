CREATE TABLE `child_account_reminder_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_account_id` integer NOT NULL,
	`next_payment_date` text NOT NULL,
	`recipient_email` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`child_account_id`) REFERENCES `child_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_account_reminder_log_once_idx` ON `child_account_reminder_log` (`child_account_id`,`next_payment_date`,`recipient_email`);--> statement-breakpoint
CREATE TABLE `child_account_reminder_subscription` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_account_id` integer NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`child_account_id`) REFERENCES `child_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_account_reminder_subscription_once_idx` ON `child_account_reminder_subscription` (`child_account_id`);