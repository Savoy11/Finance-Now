CREATE TABLE "communication_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wording_version" text NOT NULL,
	"wording" text NOT NULL,
	"given_via" text DEFAULT 'sign-up' NOT NULL,
	"agreed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communication_consents_user_idx" ON "communication_consents" USING btree ("user_id");