ALTER TABLE `space_expiry_reminder_log` ADD `reminder_date` text;--> statement-breakpoint
UPDATE `space_expiry_reminder_log` SET `reminder_date` = date(`sent_at`, 'localtime');--> statement-breakpoint
DROP INDEX `space_expiry_reminder_log_once_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `space_expiry_reminder_log_once_idx` ON `space_expiry_reminder_log` (`space_id`,`expiry_date`,`threshold_days`,`reminder_date`);
