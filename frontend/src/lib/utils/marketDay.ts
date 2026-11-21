// The day US markets are on (D213, D214): earnings, Fed decisions and the CPI, jobs, GDP and PCE
// releases are all dated in New York. Counting in UTC moves "today" to tomorrow from about 7 pm
// Eastern (8 pm in summer): a company reporting that evening dropped out of "next earnings", and the
// Macro calendar called tomorrow's CPI "today" (code audit 2026-11-09). Pure, with an injectable `now`.

/** Today's date in New York, YYYY-MM-DD. */
export function marketToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** `days` after a YYYY-MM-DD day, as YYYY-MM-DD. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}
