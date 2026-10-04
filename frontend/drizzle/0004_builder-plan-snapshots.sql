CREATE TABLE "builder_plan_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "builder_plan_snapshots" ADD CONSTRAINT "builder_plan_snapshots_plan_id_builder_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."builder_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_plan_snapshots" ADD CONSTRAINT "builder_plan_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "builder_plan_snapshots_plan_idx" ON "builder_plan_snapshots" USING btree ("plan_id","captured_at");