CREATE TABLE `mother_account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`space_id` integer NOT NULL,
	`email` text NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `space`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mother_account_space_id_unique` ON `mother_account` (`space_id`);