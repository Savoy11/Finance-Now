import { describe, expect, it } from 'vitest'
import { videoFeedNote } from '../videoFeedNote'

// Code audit 2026-11-09 (D214): the Videos page called a failed request "no channels switched on".

describe('videoFeedNote', () => {
  it('says the feed could not be loaded when the request failed, never that no channels are on', () => {
    expect(videoFeedNote({ error: 'Rate limit exceeded. Try again in a minute.' }))
      .toBe('The video feed could not be loaded right now (Rate limit exceeded. Try again in a minute.).')
    expect(videoFeedNote(undefined, new Error('Unexpected token < in JSON')))
      .toBe('The video feed could not be loaded right now (Unexpected token < in JSON).')
    expect(videoFeedNote(undefined)).toBe('The video feed could not be loaded right now.')
  })

  it('says no channels are on only when the feed answered and asked none', () => {
    expect(videoFeedNote({ ok: true, videos: [], channels: [], tried: 0, failed: [] }))
      .toMatch(/^No video channels are switched on\./)
  })

  it('names why the channel feeds failed', () => {
    const failed = [
      { provider: 'a', name: 'A', error: 'HTTP 404' }, { provider: 'b', name: 'B', error: 'HTTP 500' },
      { provider: 'c', name: 'C', error: 'HTTP 404' },
    ]
    expect(videoFeedNote({ ok: true, videos: [], channels: [], tried: 3, failed }))
      .toBe('None of the 3 channel feeds could be read (HTTP 404; HTTP 500).')
    expect(videoFeedNote({ ok: true, videos: [], channels: [], tried: 5, failed }))
      .toBe('No videos available: 3 of 5 channel feeds could not be read (HTTP 404; HTTP 500).')
    expect(videoFeedNote({ ok: true, videos: [], channels: [], tried: 2, failed: [] }))
      .toBe('No videos available: the channel feeds answered with none.')
  })
})
