/**
 * Issue a key for the public API, /api/v1 (D173).
 *
 *   npm run api:key -- --name <label>
 *
 * Prints a new key and the line to add to FN_API_KEYS. It stores nothing and changes nothing:
 * the key exists only in this terminal until the owner puts it in the server's settings and
 * hands it to whoever will call the API. Run it on the owner's machine; the key is the owner's
 * to keep, so do not paste it into a chat, a ticket or the repository.
 *
 * To withdraw a key, take its entry out of FN_API_KEYS and restart the server.
 */
import { randomBytes } from 'node:crypto'
import { envEntry, cleanName, newApiKey } from './lib/apiKeyFormat.mjs'

const args = process.argv.slice(2)
const at = args.indexOf('--name')
const name = cleanName(at >= 0 ? args[at + 1] : 'key')
const key = newApiKey(randomBytes)

console.log(`New API key "${name}" for /api/v1:

  ${key}

1. Add this entry to FN_API_KEYS on the server, comma-separated from any others, then restart:

  ${envEntry(name, key)}

   On a host that is its secret store. On your own machine, frontend/.env.local works; with any
   key set there, the API needs a key on localhost too.

2. Give the key to whoever will call the API. They send it as
   "Authorization: Bearer <key>" or "x-api-key: <key>".
   For the MCP server, set FN_API_KEY to it in the MCP config's "env".

Each key gets 60 requests a minute and 2,000 a day. To withdraw it, remove its entry and restart.
Nothing was stored: if you lose this key, issue a new one.`)
