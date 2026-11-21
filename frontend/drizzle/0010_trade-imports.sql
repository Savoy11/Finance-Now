CREATE TABLE "trade_import_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"header_signature" text NOT NULL,
	"layout" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_import_rows" (
	"trade_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"line" integer NOT NULL,
	"fingerprint" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"header_signature" text DEFAULT '' NOT NULL,
	"rows_sent" integer NOT NULL,
	"skipped_repeats" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_import_layouts" ADD CONSTRAINT "trade_import_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_import_rows" ADD CONSTRAINT "trade_import_rows_trade_id_trade_transactions_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_import_rows" ADD CONSTRAINT "trade_import_rows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_import_rows" ADD CONSTRAINT "trade_import_rows_import_id_trade_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."trade_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_import_rows" ADD CONSTRAINT "trade_import_rows_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_imports" ADD CONSTRAINT "trade_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_imports" ADD CONSTRAINT "trade_imports_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_import_layouts_signature_unique" ON "trade_import_layouts" USING btree ("user_id","header_signature");--> statement-breakpoint
CREATE INDEX "trade_import_rows_user_idx" ON "trade_import_rows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_import_rows_import_idx" ON "trade_import_rows" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "trade_import_rows_fingerprint_idx" ON "trade_import_rows" USING btree ("portfolio_id","fingerprint");--> statement-breakpoint
CREATE INDEX "trade_imports_user_idx" ON "trade_imports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_imports_portfolio_idx" ON "trade_imports" USING btree ("portfolio_id");