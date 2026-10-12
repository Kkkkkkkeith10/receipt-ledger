-- Add expense_reports table for caching generated reports
CREATE TABLE IF NOT EXISTS `expense_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`fiscal_year` integer NOT NULL UNIQUE,
	`report_data` text NOT NULL,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- SQLite requires table recreation to add GENERATED columns
-- Step 1: Create new table with all columns
CREATE TABLE `receipts_new` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_data` text NOT NULL,
	`vendor` text GENERATED ALWAYS AS (json_extract(receipt_data, '$.vendor')) VIRTUAL,
	`amount` real GENERATED ALWAYS AS (json_extract(receipt_data, '$.amount')) VIRTUAL,
	`date` text GENERATED ALWAYS AS (json_extract(receipt_data, '$.date')) VIRTUAL,
	`category` text GENERATED ALWAYS AS (json_extract(receipt_data, '$.category')) VIRTUAL,
	`fiscal_year` integer GENERATED ALWAYS AS (json_extract(receipt_data, '$.fiscalYear')) VIRTUAL,
	`status` text GENERATED ALWAYS AS (json_extract(receipt_data, '$.status')) VIRTUAL,
	`tax_deductible` integer GENERATED ALWAYS AS (json_extract(receipt_data, '$.taxDeductible')) VIRTUAL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy data
INSERT INTO `receipts_new` (`id`, `receipt_data`, `created_at`, `updated_at`)
SELECT `id`, `receipt_data`, `created_at`, `updated_at` FROM `receipts`;

-- Step 3: Drop old table
DROP TABLE `receipts`;

-- Step 4: Rename new table
ALTER TABLE `receipts_new` RENAME TO `receipts`;

-- Create indexes
CREATE INDEX IF NOT EXISTS `idx_receipts_fiscal_year` ON `receipts` (`fiscal_year`);
CREATE INDEX IF NOT EXISTS `idx_receipts_status` ON `receipts` (`status`);
CREATE INDEX IF NOT EXISTS `idx_receipts_date` ON `receipts` (`date`);
CREATE INDEX IF NOT EXISTS `idx_receipts_category` ON `receipts` (`category`);
