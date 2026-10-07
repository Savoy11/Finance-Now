'use client'

import { AgentScanPanel } from './AgentScanPanel'
import { EQUITY_OUTLIER_SCAN } from './agentScans'

// Runs the Equity Screener agent, which scans the whole universe for
// sector-relative outliers and explains them. Lives on the Stock Registry and the
// Equity Scanner. The panel itself is shared with the Macro Scanner's AI Movers
// Scan (AgentScanPanel), so the two cannot drift apart.

export function OutlierScanPanel() {
  return <AgentScanPanel scan={EQUITY_OUTLIER_SCAN} />
}
