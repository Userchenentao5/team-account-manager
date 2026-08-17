ALTER TABLE `space` ADD `seat_capacity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `space`
SET `seat_capacity` = MAX(
  `seat_capacity`,
  (SELECT COUNT(*) FROM `mother_account`
    WHERE `mother_account`.`space_id` = `space`.`id`
      AND `mother_account`.`seat_type` = 'chatgpt') +
  (SELECT COUNT(*) FROM `child_account`
    WHERE `child_account`.`space_id` = `space`.`id`
      AND `child_account`.`seat_type` = 'chatgpt')
);
