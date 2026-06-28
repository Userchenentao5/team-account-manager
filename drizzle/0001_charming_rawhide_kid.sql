CREATE TABLE `fx_rate` (
	`currency_code` text PRIMARY KEY NOT NULL,
	`rate_to_usd` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`currency_code`) REFERENCES `currency`(`code`) ON UPDATE no action ON DELETE no action
);
