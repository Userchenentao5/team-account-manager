ALTER TABLE `payment_channel` ADD `bank_card_last4` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `payment_channel`
SET `bank_card_last4` = substr(`name`, -4)
WHERE length(`name`) > 4
  AND `name` GLOB '*[0-9][0-9][0-9][0-9]';--> statement-breakpoint
UPDATE `payment_channel`
SET `name` = substr(`name`, 1, length(`name`) - 4)
WHERE length(`name`) > 4
  AND `name` GLOB '*[0-9][0-9][0-9][0-9]';
