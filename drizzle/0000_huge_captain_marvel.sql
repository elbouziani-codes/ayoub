CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`image` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "order_items_quantity_positive" CHECK("order_items"."quantity" > 0),
	CONSTRAINT "order_items_price_positive" CHECK("order_items"."price" > 0)
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`customer` text NOT NULL,
	`subtotal` integer NOT NULL,
	`shipping` integer NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`tracking_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "orders_status_valid" CHECK("orders"."status" IN ('pending','confirmed','shipped','delivered','cancelled')),
	CONSTRAINT "orders_totals_valid" CHECK("orders"."subtotal" > 0 AND "orders"."shipping" >= 0 AND "orders"."total" = "orders"."subtotal" + "orders"."shipping")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_idx` ON `orders` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `orders_created_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`name_fr` text,
	`name_ar` text,
	`description_fr` text,
	`description_ar` text,
	`price` integer NOT NULL,
	`compare_at` integer,
	`category` text NOT NULL,
	`color` text NOT NULL,
	`movement` text NOT NULL,
	`case_size` text NOT NULL,
	`water_resistance` text NOT NULL,
	`material` text NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`images` text NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`badge` text,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "products_stock_nonnegative" CHECK("products"."stock" >= 0),
	CONSTRAINT "products_price_positive" CHECK("products"."price" > 0),
	CONSTRAINT "products_category_valid" CHECK("products"."category" IN ('Classic','Sport','Minimal','Limited'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_visible_sort_idx` ON `products` (`archived`,`sort_order`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expiry_idx` ON `rate_limits` (`expires_at`);