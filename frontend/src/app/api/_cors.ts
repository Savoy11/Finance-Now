import { NextResponse } from 'next/server'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  // POST for /api/v1/options/score. x-api-key beside Authorization: either carries the API key
  // (lib/server/apiKeys.ts, D173), and a browser client sends neither without this list.
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

// Handles preflight OPTIONS requests — re-export from every v1 route as `options`
export function options() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
