ALTER TABLE "auth"."session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "ban_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD CONSTRAINT "user_role_check" CHECK ("auth"."user"."role" IN ('user', 'admin'));