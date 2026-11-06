CREATE TABLE `admin_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`recovery_email` text NOT NULL,
	`bootstrap_version` text NOT NULL,
	CONSTRAINT "admin_accounts_singleton" CHECK("admin_accounts"."id" = 'admin')
);
