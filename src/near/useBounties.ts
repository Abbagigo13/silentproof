/**
 * React hooks for contract data.
 * Polls live NEAR RPC for bounties and reports.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  getActiveBounties,
  getBountiesByOrg,
  getReportsForOrg,
  type Bounty,
  type Report,
} from './contract'
import { yoctoToUsdc } from './config'

// ─── Public bounty list ───────────────────────────────────────────────────────

export function useBounties() {
  const [state, setState] = useState<{
    bounties: Bounty[]
    loading: boolean
    error: string | null
  }>({ bounties: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    try {
      const data = await getActiveBounties()
      setState({ bounties: data, loading: false, error: null })
    } catch (e) {
      setState(s => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load bounties',
      }))
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(() => { void refetch() }, 0)
    const id = setInterval(() => { void refetch() }, 30_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [refetch])

  return { ...state, refetch }
}

// ─── Org view: own bounties + reports on them ─────────────────────────────────

export function useOrgData(orgAccount: string | null) {
  const [state, setState] = useState<{
    bounties: Bounty[]
    reports: Report[]
    loading: boolean
    error: string | null
  }>({ bounties: [], reports: [], loading: true, error: null })

  const refetch = useCallback(async () => {
    if (!orgAccount) return
    try {
      const [bounties, reports] = await Promise.all([
        getBountiesByOrg(orgAccount),
        getReportsForOrg(orgAccount),
      ])
      setState({ bounties, reports, loading: false, error: null })
    } catch (e) {
      setState(s => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load org data',
      }))
    }
  }, [orgAccount])

  useEffect(() => {
    const first = setTimeout(() => { void refetch() }, 0)
    const id = setInterval(() => { void refetch() }, 15_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [refetch])

  return { ...state, refetch }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatUsdc(baseUnits: string): string {
  return yoctoToUsdc(baseUnits).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/** Nanosecond block timestamp to a JS Date. */
export function nsToDate(ns: number): Date {
  return new Date(ns / 1_000_000)
}
