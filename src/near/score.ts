/**
 * Asks the hosted scorer (api/score) to score any pending reports.
 * Safe to call at any time: it does nothing when there is nothing to score,
 * and failures are ignored because the dashboard retries.
 */
export interface ScoreRun {
  scored: number[]
  failed: { id: number; error: string }[]
  remaining: number
}

export async function requestScoring(): Promise<ScoreRun | null> {
  try {
    const res = await fetch('/api/score', { method: 'POST' })
    if (!res.ok) return null
    return (await res.json()) as ScoreRun
  } catch {
    return null
  }
}
