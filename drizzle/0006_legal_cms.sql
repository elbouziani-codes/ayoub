CREATE TABLE `store_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`settings` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	CONSTRAINT "store_settings_singleton" CHECK("store_settings"."id" = 'store')
);
--> statement-breakpoint
CREATE TABLE `legal_pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`draft_version_id` text,
	`published_version_id` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `legal_page_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_slug` text NOT NULL,
	`version` integer NOT NULL,
	`title_en` text NOT NULL,
	`title_fr` text NOT NULL,
	`title_ar` text NOT NULL,
	`sections_en` text NOT NULL,
	`sections_fr` text NOT NULL,
	`sections_ar` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text,
	FOREIGN KEY (`page_slug`) REFERENCES `legal_pages`(`slug`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "legal_page_versions_status_valid" CHECK("legal_page_versions"."status" IN ('draft','published','archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_page_versions_number_idx` ON `legal_page_versions` (`page_slug`,`version`);--> statement-breakpoint
CREATE INDEX `legal_page_versions_page_idx` ON `legal_page_versions` (`page_slug`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_policy_acceptances` (
	`order_id` text PRIMARY KEY NOT NULL,
	`legal_version_id` text NOT NULL,
	`locale` text NOT NULL,
	`terms_accepted` integer NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`accepted_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`legal_version_id`) REFERENCES `legal_page_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "order_policy_locale_valid" CHECK("order_policy_acceptances"."locale" IN ('en','fr','ar')),
	CONSTRAINT "order_policy_terms_required" CHECK("order_policy_acceptances"."terms_accepted" = 1)
);
--> statement-breakpoint
CREATE TABLE `customer_complaints` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`order_number` text,
	`customer_name` text NOT NULL,
	`email` text,
	`phone` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`tracking_hash` text NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "customer_complaints_status_valid" CHECK("customer_complaints"."status" IN ('open','reviewing','resolved','closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_complaints_reference_unique` ON `customer_complaints` (`reference`);--> statement-breakpoint
CREATE INDEX `customer_complaints_status_idx` ON `customer_complaints` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `return_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`order_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "return_requests_status_valid" CHECK("return_requests"."status" IN ('requested','approved','rejected','received','refunded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `return_requests_reference_unique` ON `return_requests` (`reference`);--> statement-breakpoint
CREATE INDEX `return_requests_status_idx` ON `return_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_email` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`changes` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_logs_created_idx` ON `admin_audit_logs` (`created_at`);
