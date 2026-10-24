/**
 * React hooks for contract data.
 * Polls live NEAR RPC for bounties and reports.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { getBounties, getReportsForBounty, getAllReports, type Bounty, type Report } from './contract'
import { yoctoToUsdc } from './config'

// ─── Bounty list ──────────────────────────────────────────────────────────────

export function useBounties() {
  const [state, setState] = useState<{
    bounties: Bounty[]
    loading: boolean
    error: string | null
  }>({ bounties: [], loading: true, error: null })

  const fetch = useCallback(async () => {
    try {
      const data = await getBounties()
      setState({ bounties: data, loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Failed to load bounties' }))
    }
  }, [])

  useEffect(() => {
    void fetch()
    const id = setInterval(() => { void fetch() }, 30_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ...state, refetch: fetch }
}

// ─── Reports for a single bounty ─────────────────────────────────────────────

export function useReports(bountyId: string | null) {
  const [state, setState] = useState<{ reports: Report[]; loading: boolean }>({
    reports: [],
    loading: false,
  })
  const prevId = useRef<string | null>(null)

  useEffect(() => {
    if (!bountyId || bountyId === prevId.current) return
    prevId.current = bountyId
    setState({ reports: [], loading: true })
    getReportsForBounty(bountyId)
      .then(reports => setState({ reports, loading: false }))
      .catch(() => setState({ reports: [], loading: false }))
  }, [bountyId])

  return state
}

// ─── All reports (org view) ───────────────────────────────────────────────────

export function useAllReports() {
  const [state, setState] = useState<{
    reports: Report[]
    loading: boolean
    error: string | null
  }>({ reports: [], loading: true, error: null })

  const fetch = useCallback(async () => {
    try {
      const data = await getAllReports()
      setState({ reports: data, loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Failed to load reports' }))
    }
  }, [])

  useEffect(() => {
    void fetch()
    const id = setInterval(() => { void fetch() }, 15_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ...state, refetch: fetch }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatUsdc(yocto: string): string {
  return yoctoToUsdc(yocto).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}
