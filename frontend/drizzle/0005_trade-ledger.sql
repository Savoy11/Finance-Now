CREATE TABLE "tracked_portfolios" (
	"portfolio_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_cancellations" (
	"trade_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_transactions" ALTER COLUMN "executed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_transactions" ADD COLUMN "opening" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tracked_portfolios" ADD CONSTRAINT "tracked_portfolios_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_portfolios" ADD CONSTRAINT "tracked_portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_cancellations" ADD CONSTRAINT "trade_cancellations_trade_id_trade_transactions_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_cancellations" ADD CONSTRAINT "trade_cancellations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tracked_portfolios_user_idx" ON "tracked_portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_cancellations_user_idx" ON "trade_cancellations" USING btree ("user_id");