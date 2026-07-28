UPDATE `child_account`
SET `seat_type` = 'chatgpt'
WHERE `space_id` IN (
  SELECT `space_id`
  FROM `mother_account`
  WHERE `can_change_seat_type` = 0
);
--> statement-breakpoint
UPDATE `mother_account`
SET `seat_type` = 'chatgpt'
WHERE `can_change_seat_type` = 0;
