CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"actor" text NOT NULL,
	"event" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id","at");--> statement-breakpoint
CREATE FUNCTION audit_log_immutable() RETURNS trigger AS $worm$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % refused (T-185, D235)', TG_OP;
END;
$worm$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_worm
BEFORE UPDATE OR DELETE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
