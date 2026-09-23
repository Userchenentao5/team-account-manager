UPDATE `space`
SET `opening_date` = `opening_date` || 'T00:00:00'
WHERE `opening_date` IS NOT NULL
  AND length(`opening_date`) = 10
  AND `opening_date` GLOB '????-??-??';--> statement-breakpoint
UPDATE `space`
SET `current_period_start_date` = `current_period_start_date` || 'T00:00:00'
WHERE `current_period_start_date` IS NOT NULL
  AND length(`current_period_start_date`) = 10
  AND `current_period_start_date` GLOB '????-??-??';--> statement-breakpoint
UPDATE `space`
SET `expiry_date` = `expiry_date` || 'T00:00:00'
WHERE `expiry_date` IS NOT NULL
  AND length(`expiry_date`) = 10
  AND `expiry_date` GLOB '????-??-??';--> statement-breakpoint
UPDATE `space_expiry_reminder_log`
SET `expiry_date` = `expiry_date` || 'T00:00:00'
WHERE length(`expiry_date`) = 10
  AND `expiry_date` GLOB '????-??-??';
