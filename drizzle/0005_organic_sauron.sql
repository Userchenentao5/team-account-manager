ALTER TABLE `currency` ADD `country_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `currency` ADD `country_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'AU', `country_name` = '澳大利亚' WHERE `code` = 'AUD';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'BR', `country_name` = '巴西' WHERE `code` = 'BRL';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'CA', `country_name` = '加拿大' WHERE `code` = 'CAD';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'CH', `country_name` = '瑞士' WHERE `code` = 'CHF';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'CN', `country_name` = '中国' WHERE `code` = 'CNY';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'CZ', `country_name` = '捷克' WHERE `code` = 'CZK';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'DK', `country_name` = '丹麦' WHERE `code` = 'DKK';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'EU', `country_name` = '欧元区' WHERE `code` = 'EUR';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'GB', `country_name` = '英国' WHERE `code` = 'GBP';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'HK', `country_name` = '中国香港' WHERE `code` = 'HKD';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'HU', `country_name` = '匈牙利' WHERE `code` = 'HUF';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'ID', `country_name` = '印度尼西亚' WHERE `code` = 'IDR';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'IL', `country_name` = '以色列' WHERE `code` = 'ILS';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'IN', `country_name` = '印度' WHERE `code` = 'INR';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'IS', `country_name` = '冰岛' WHERE `code` = 'ISK';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'JP', `country_name` = '日本' WHERE `code` = 'JPY';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'KR', `country_name` = '韩国' WHERE `code` = 'KRW';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'MX', `country_name` = '墨西哥' WHERE `code` = 'MXN';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'MY', `country_name` = '马来西亚' WHERE `code` = 'MYR';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'NO', `country_name` = '挪威' WHERE `code` = 'NOK';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'NZ', `country_name` = '新西兰' WHERE `code` = 'NZD';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'PH', `country_name` = '菲律宾' WHERE `code` = 'PHP';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'PL', `country_name` = '波兰' WHERE `code` = 'PLN';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'RO', `country_name` = '罗马尼亚' WHERE `code` = 'RON';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'SE', `country_name` = '瑞典' WHERE `code` = 'SEK';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'SG', `country_name` = '新加坡' WHERE `code` = 'SGD';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'TH', `country_name` = '泰国' WHERE `code` = 'THB';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'TR', `country_name` = '土耳其' WHERE `code` = 'TRY';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'US', `country_name` = '美国' WHERE `code` = 'USD';--> statement-breakpoint
UPDATE `currency` SET `country_code` = 'ZA', `country_name` = '南非' WHERE `code` = 'ZAR';
