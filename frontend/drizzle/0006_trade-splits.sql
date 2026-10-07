CREATE TABLE "trade_splits" (
	"trade_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"units_after" integer NOT NULL,
	"units_before" integer NOT NULL,
	"cash_in_lieu_usd" numeric(20, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_splits" ADD CONSTRAINT "trade_splits_trade_id_trade_transactions_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_splits" ADD CONSTRAINT "trade_splits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_splits_user_idx" ON "trade_splits" USING btree ("user_id");