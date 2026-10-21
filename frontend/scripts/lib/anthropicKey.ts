/**
 * The Anthropic key for the owner's paid scripts (the site terms check, the fund figures
 * pre-fill), found the way getProviderKey finds it in the app. Never printed: `source` names
 * where the key came from, never the key, since a refused key has to be replaced where it lives.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readProviderConfigs } from './providerConfigFile.mjs'

/** Same dependency-free loader as scripts/auth-consent.ts: the real environment wins over the file. */
function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env.local: rely on the environment */ }
}

/**
 * The Integrations key first, then the environment. `note` says why the Integrations page's
 * keys could not be read, if not.
 */
export function anthropicKey(): { key: string | null; source: string; note: string | null } {
  const { configs, error } = readProviderConfigs()
  const saved = configs?.anthropic?.apiKey
  if (typeof saved === 'string' && saved.trim()) return { key: saved.trim(), source: 'the Integrations page', note: null }
  const shell = process.env.ANTHROPIC_API_KEY?.trim()
  if (shell) return { key: shell, source: 'ANTHROPIC_API_KEY in this PowerShell window', note: error }
  loadEnvLocal()
  const local = process.env.ANTHROPIC_API_KEY?.trim()
  return { key: local || null, source: 'ANTHROPIC_API_KEY in frontend\\.env.local', note: error }
}
