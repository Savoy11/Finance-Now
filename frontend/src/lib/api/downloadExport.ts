// Downloads one part of "Download my data" (/api/user/export) as a file in the browser.
// Settings → Your data (T-452) and a tracked portfolio's sales list (T-460) both use it.

/** Fetches `/api/user/export?<query>` and saves the reply under the name the server gives. Resolves to an error message, or null. */
export async function downloadExport(query: string, fallbackName: string): Promise<string | null> {
  try {
    const res = await fetch(query ? `/api/user/export?${query}` : '/api/user/export')
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      return body?.error ?? `The download did not work (HTTP ${res.status}).`
    }
    const blob = await res.blob()
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
    return null
  } catch {
    return 'The download did not work. Check your connection and try again.'
  }
}
