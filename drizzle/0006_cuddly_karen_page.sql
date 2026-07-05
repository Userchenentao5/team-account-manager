ALTER TABLE `space` ADD `current_period_start_date` text;--> statement-breakpoint
UPDATE `space` SET `current_period_start_date` = `opening_date` WHERE `current_period_start_date` IS NULL;
