CREATE TABLE "asset_rating_readings" (
	"asset_kind" text NOT NULL,
	"asset_id" text NOT NULL,
	"week_start" date NOT NULL,
	"methodology_version" text NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"cls" smallint NOT NULL,
	"shown_cls" smallint NOT NULL,
	"core_cls" smallint NOT NULL,
	"capped" boolean NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_rating_readings_pk" PRIMARY KEY("asset_kind","asset_id","methodology_version","week_start")
);
