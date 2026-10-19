/**
 * A provider's own words on a refused request, for the Integrations Test button.
 *
 * The button said only "HTTP 400" when Anthropic refused a new key (2026-10-19), and a status
 * cannot tell a malformed key from a wrong kind of key or a missing permission. Anthropic's
 * error body is `{ error: { message } }`; the OpenAI-compatible providers send the same shape,
 * and a few send `error` or `message` as plain text. The key itself never appears in what is
 * returned, even if a provider echoes it, and the text is cut short so a page of HTML cannot
 * fill the panel.
 */

const MAX_CHARS = 200

export function providerRefusal(body: unknown, key: string | undefined): string {
  const b = body as { error?: unknown; message?: unknown } | null
  const err = b?.error as { message?: unknown } | string | undefined
  const raw = typeof err === 'object' && err !== null && typeof err.message === 'string' ? err.message
    : typeof err === 'string' ? err
    : typeof b?.message === 'string' ? b.message
    : ''
  // A real key is long; a short one would only mangle ordinary words.
  const text = (key && key.length >= 8 ? raw.split(key).join('[key]') : raw).replace(/\s+/g, ' ').trim()
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text
}
