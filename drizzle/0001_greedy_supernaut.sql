ALTER TABLE "zfweb_discount" ALTER COLUMN "number_of_uses" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "zfweb_discount" ADD COLUMN "code" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "zfweb_discount" ADD COLUMN "discount_type" varchar(16) DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "zfweb_discount" ADD COLUMN "max_uses" integer;--> statement-breakpoint
ALTER TABLE "zfweb_discount" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zfweb_order" ADD COLUMN "is_downloaded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zfweb_order" ADD COLUMN "downloaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zfweb_order" ADD COLUMN "is_packed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zfweb_order" ADD COLUMN "packed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zfweb_order" ADD COLUMN "is_shipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zfweb_order" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zfweb_order" ADD COLUMN "tracking_number" varchar(256);--> statement-breakpoint
ALTER TABLE "zfweb_discount" ADD CONSTRAINT "zfweb_discount_code_unique" UNIQUE("code");