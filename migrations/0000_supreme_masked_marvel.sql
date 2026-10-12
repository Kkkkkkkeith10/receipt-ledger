CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_data` text NOT NULL,
	`vendor` text GENERATED ALWAYS AS (json_extract(receipt_data, '$.vendor')) VIRTUAL,
	`amount` real GENERATED ALWAYS AS (json_extract(receipt_data, '$.amount')) VIRTUAL,
	`date` text GENERATED ALWAYS AS (json_extract(receipt_data, '$.date')) VIRTUAL,
	`category` text GENERATED ALWAYS AS (json_extract(receipt_data, '$.category')) VIRTUAL,
	`tax_deductible` integer GENERATED ALWAYS AS (json_extract(receipt_data, '$.tax_deductible')) VIRTUAL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_data` text NOT NULL,
	`date` text GENERATED ALWAYS AS (json_extract(transaction_data, '$.date')) VIRTUAL,
	`total_amount` real GENERATED ALWAYS AS (json_extract(transaction_data, '$.total_amount')) VIRTUAL,
	`status` text GENERATED ALWAYS AS (json_extract(transaction_data, '$.status')) VIRTUAL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`hashed_password` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);