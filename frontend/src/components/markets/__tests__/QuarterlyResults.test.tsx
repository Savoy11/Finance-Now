import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QuarterlyResults } from '../QuarterlyResults'
import type { Quarter } from '@/lib/utils/companyQuarters'

// The stock page's quarterly card (T-461), as fixed by the code audit of 2026-11-12 (D226): its
// heading counts the quarters it has, and a fourth quarter that could not be worked out shows a
// dash with the reason rather than a figure or nothing.

const fig = (value: number, workedOut = false) => ({ value, workedOut, concept: 'Revenues' })
const quarter = (end: string, start: string, extra: Partial<Quarter> = {}): Quarter => ({
  start, end, revenue: fig(100), netIncome: fig(10), eps: null,
  revenueChangePct: null, netIncomeChangePct: null, epsChangePct: null, ...extra,
})

function render(quarters: Quarter[]) {
  const client = new QueryClient()
  client.setQueryData(['company-facts', 'XYZ'], { ok: true, quarters })
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><QuarterlyResults symbol="XYZ" /></QueryClientProvider>)
  return { html, text: html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim() }
}

describe('QuarterlyResults', () => {
  it('heads the card with the number of quarters it has', () => {
    // Mutation: put back the fixed "Last 8 Quarters" and this fails.
    const { text } = render([quarter('2025-09-30', '2025-07-01'), quarter('2025-06-30', '2025-04-01')])
    expect(text).toContain('Last 2 Quarters')
    expect(text).not.toContain('Last 8 Quarters')
  })

  it('shows a fourth quarter it could not work out as a dash, with the reason', () => {
    // Mutation: drop the withheld cell and the row reads as a plain dash with no reason.
    const { html, text } = render([
      quarter('2025-12-31', '2025-10-01', { revenue: null, netIncome: fig(-20, true), revenueWithheld: 'restated' }),
      quarter('2025-09-30', '2025-07-01'),
    ])
    expect(html).toContain('title="Not worked out: the annual report changed earlier figures')
    expect(html).toContain('data-testid="q4-withheld"')
    expect(text).toMatch(/† Not worked out for that fourth quarter: the annual report changed earlier figures/)
  })

  it('says nothing of the kind when every quarter has its figures', () => {
    const { html } = render([quarter('2025-09-30', '2025-07-01')])
    expect(html).not.toContain('q4-withheld')
    expect(html).not.toContain('†')
  })
})
