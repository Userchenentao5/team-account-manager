ALTER TABLE `currency` ADD `symbol` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `currency` SET `symbol` = '$' WHERE `code` = 'USD';
--> statement-breakpoint
UPDATE `currency` SET `symbol` = '￥' WHERE `code` = 'CNY';
--> statement-breakpoint
UPDATE `currency` SET `symbol` = '€' WHERE `code` = 'EUR';
--> statement-breakpoint
UPDATE `currency` SET `symbol` = '£' WHERE `code` = 'GBP';
--> statement-breakpoint
UPDATE `currency` SET `symbol` = '￥' WHERE `code` = 'JPY';
--> statement-breakpoint
UPDATE `currency` SET `symbol` = 'HK$' WHERE `code` = 'HKD';
