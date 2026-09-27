import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WORKSPACE_CAPABILITIES, itemsJson, workspaceItemSlot, workspaceScripts, workspaceSection,
} from '../../../../scripts/lib/ledgerWorkspace.mjs'

/**
 * The shared workspace on the published Finance Now Ledger page (2026-09-27).
 *
 * The ledger page is regenerated from the repository JSON, so uploads and confirmations
 * live in the artifact's runtime storage (db + assets) rather than in the HTML. These
 * pin what that design depends on, and the owner's rules the browser half must keep:
 * nothing is ever deleted, and other people's text never reaches the page as markup.
 */
const client = readFileSync(join(process.cwd(), 'scripts/lib/ledgerWorkspace.client.js'), 'utf8')
const code = client.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const generator = readFileSync(join(process.cwd(), 'scripts/check-queue-ledger.mjs'), 'utf8')

describe('the page can carry the workspace', () => {
  it('declares the three runtime capabilities it uses, and nothing else', () => {
    expect(Object.keys(WORKSPACE_CAPABILITIES).sort()).toEqual(['assets', 'db', 'user'])
  })

  it('reaches capabilities only through claude.use, never a window.claude member', () => {
    expect(code).toMatch(/c\.use\('db'\)/)
    expect(code).toMatch(/c\.use\('assets'\)/)
    expect(code).toMatch(/c\.use\('user'\)/)
    expect(code).not.toMatch(/window\.claude\.(db|assets|user|room|artifact)/)
  })

  it('renders the ledger without the workspace: a missing claude or a null db is a message, not a crash', () => {
    expect(code).toMatch(/if \(!c \|\| typeof c\.use !== 'function'\)/)
    expect(code).toMatch(/if \(!db\) \{/)
  })

  it('the generator places the section, a slot per item, the styles and the scripts', () => {
    expect(generator).toMatch(/import \{ WORKSPACE_CSS, workspaceSection, workspaceItemSlot, workspaceScripts \} from '\.\/lib\/ledgerWorkspace\.mjs'/)
    expect(generator).toMatch(/\$\{workspaceSection\(\)\}/)
    expect(generator).toMatch(/\$\{workspaceItemSlot\(i\.id\)\}/)
    expect(generator).toMatch(/\$\{WORKSPACE_CSS\}/)
    expect(generator).toMatch(/\$\{workspaceScripts\(items\)\}/)
    expect(generator).toMatch(/data-id="\$\{esc\(i\.id\)\}"/)
  })
})

describe("the owner's rules", () => {
  it('never deletes — not an asset, not a document; a mistaken upload is archived', () => {
    expect(code).not.toMatch(/\.delete\s*\(/)
    expect(code).toMatch(/update\(\{ archived: archived \}\)/)
  })

  it('never builds markup from text: no innerHTML, insertAdjacentHTML or document.write', () => {
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/)
  })

  it('stores who acted as an id, never a name', () => {
    expect(code).toMatch(/uploadedBy: me/)
    expect(code).toMatch(/by: me, at:/)
    expect(code).not.toMatch(/uploadedBy: .*name|by: .*\.name/)
  })

  it('a confirmation records intent; the page says the ledger is still pending', () => {
    expect(code).toMatch(/ledger pending/)
    expect(workspaceSection()).toMatch(/ledger pending/)
  })
})

describe('embedding is safe', () => {
  it('a title containing a closing script tag cannot break out of the JSON block', () => {
    const json = itemsJson([{ id: 'T-1', title: '</script><img src=x onerror=alert(1)>', status: 'open' }])
    expect(json).not.toMatch(/<\/script/i)
    expect(JSON.parse(json)[0].title).toBe('</script><img src=x onerror=alert(1)>')
  })

  it('carries only id, title and status per item — no closures, notes or evidence', () => {
    const parsed = JSON.parse(itemsJson([{ id: 'T-2', title: 't', status: 'closed', summary: 's', closure: { reason: 'r' } }]))
    expect(Object.keys(parsed[0]).sort()).toEqual(['id', 'status', 'title'])
  })

  it('an item slot keeps only id-safe characters', () => {
    expect(workspaceItemSlot('T-3"><script>')).toBe('<div class="ws-slot" data-ws-item="T-3script" hidden></div>')
  })

  it('the inlined script contains no closing script tag, and the builder refuses one', () => {
    expect(client).not.toMatch(/<\/script/i)
    expect(workspaceScripts([]).match(/<\/script>/g)?.length).toBe(2)
  })
})

describe('uploads say what they accept before they fail', () => {
  it('the accepted set matches the asset store, and Word/Excel are named as needing export', () => {
    for (const ext of ['pdf', 'png', 'jpg', 'svg', 'csv', 'md', 'json', 'txt', 'mp4']) expect(code).toMatch(new RegExp(`\\b${ext}: '`))
    expect(code).not.toMatch(/docx|xlsx|msword|officedocument/)
    expect(workspaceSection()).toMatch(/Word and Excel files need exporting to PDF or CSV first/)
  })

  it('checks size before uploading: 20 MB, 2 MB for SVG', () => {
    expect(code).toMatch(/type === 'image\/svg\+xml' \? 2 \* MB : 20 \* MB/)
  })

  it('retries store_unavailable once and no other code', () => {
    expect(code.match(/store_unavailable/g)?.length).toBe(1)
  })
})
