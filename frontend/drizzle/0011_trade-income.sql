CREATE TABLE "trade_income" (
	"trade_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_usd" numeric(20, 2) NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_income" ADD CONSTRAINT "trade_income_trade_id_trade_transactions_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_income" ADD CONSTRAINT "trade_income_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_income_user_idx" ON "trade_income" USING btree ("user_id");