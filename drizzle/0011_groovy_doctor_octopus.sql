CREATE TABLE `space_expiry_reminder_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`space_id` integer NOT NULL,
	`expiry_date` text NOT NULL,
	`threshold_days` integer NOT NULL,
	`recipient_email` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `space`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `space_expiry_reminder_log_once_idx` ON `space_expiry_reminder_log` (`space_id`,`expiry_date`,`threshold_days`);