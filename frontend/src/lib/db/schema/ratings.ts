import { pgTable, text, timestamp, date, smallint, numeric, boolean, primaryKey } from 'drizzle-orm/pg-core'

// ─── Measured-risk weekly readings (T-420 item 3) ───────────────────────────
//
// The stability rule (docs/architecture/risk-ratings-methodology.md §5 item 6)
// changes the class shown only when every weekly reading over the last
// `stabilityWeeks` lies outside it, so the readings have to outlive a request.
// One row per asset, per calendar week (Monday, UTC), per methodology version.
//
// The FIRST rating computed in a week is that week's reading: the rating route
// inserts with ON CONFLICT DO NOTHING, so a row is written once and never
// rewritten. Readings under a different methodology version are never mixed in:
// a new version starts every asset at its current class.
//
// Not user data. Every reader sees the same rating (the publisher's form, T-419),
// so there is no user_id. Nothing removes a row (the owner's no-deletion rule);
// the table grows by one row per rated asset per week.

export const assetRatingReadings = pgTable('asset_rating_readings', {
  /** 'crypto' | 'stock' (RatedAssetKind). */
  assetKind: text('asset_kind').notNull(),
  /** CoinGecko id for a coin, ticker for a stock. */
  assetId: text('asset_id').notNull(),
  /** Monday of the reading's week, UTC. */
  weekStart: date('week_start').notNull(),
  /** METHODOLOGY_V1.version (or a later one) the reading was computed under. */
  methodologyVersion: text('methodology_version').notNull(),
  score: numeric('score', { precision: 5, scale: 2 }).notNull(),
  /** Class from the score alone, 1–7. */
  cls: smallint('cls').notNull(),
  /** Class shown after the stability rule, 1–7. The next week's previous-shown class. */
  shownCls: smallint('shown_cls').notNull(),
  coreCls: smallint('core_cls').notNull(),
  capped: boolean('capped').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Column order serves the one query: an asset's readings under one version, by week.
  // Named: the generated name is 76 characters and Postgres cuts identifiers at 63.
  pk: primaryKey({ name: 'asset_rating_readings_pk', columns: [t.assetKind, t.assetId, t.methodologyVersion, t.weekStart] }),
}))

export type AssetRatingReadingRow = typeof assetRatingReadings.$inferSelect
