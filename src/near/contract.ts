/**
 * SilentProof — Typed NEAR contract bindings
 *
 * All contract interactions go through these functions.
 * View calls use raw JSON-RPC (no wallet needed).
 * Change calls use callContract() which requires a signed-in wallet.
 */

import { callContract, viewContract } from './wallet'
import {
  CONTRACT_ADDRESS,
  USDC_CONTRACT,
  FUND_GAS,
  DEFAULT_GAS,
  usdcToYocto,
} from './config'

// ─── Shared types (mirror the Rust contract) ──────────────────────────────────

export type BountyCategory = 'Fraud' | 'Security' | 'Policy' | 'Legal'
export type SeverityTier = 'Critical' | 'High' | 'Medium'
export type ReportStatus = 'Pending' | 'Confirmed' | 'Rejected'

export interface PayoutTiers {
  critical: string  // USDC in yocto (6 decimals)
  high: string
  medium: string
}

export interface Bounty {
  id: string
  creator: string
  title: string
  description: string
  category: BountyCategory
  tiers: PayoutTiers
  pool_balance: string
  expiry_timestamp_ms: number
  active: boolean
  report_count: number
}

export interface Report {
  id: string
  bounty_id: string
  ipfs_cid: string
  payout_address_hash: string
  wrapped_key_hex: string
  ephemeral_pubkey_hex: string
  submitted_at_ms: number
  status: ReportStatus
  tier: SeverityTier | null
  credibility_score: number | null
  tee_summary: string | null
  tee_signature_hex: string | null
}

// ─── View calls (read-only, no wallet needed) ─────────────────────────────────

export async function getBounties(): Promise<Bounty[]> {
  return viewContract<Bounty[]>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_bounties',
    args: { limit: 50, offset: 0 },
  })
}

export async function getBounty(bountyId: string): Promise<Bounty | null> {
  return viewContract<Bounty | null>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_bounty',
    args: { bounty_id: bountyId },
  })
}

export async function getReportsForBounty(bountyId: string): Promise<Report[]> {
  return viewContract<Report[]>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_reports_for_bounty',
    args: { bounty_id: bountyId },
  })
}

export async function getAllReports(): Promise<Report[]> {
  return viewContract<Report[]>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_all_reports',
    args: { limit: 100, offset: 0 },
  })
}

export async function getTeePublicKey(): Promise<string | null> {
  return viewContract<string | null>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_tee_public_key',
    args: {},
  })
}

// ─── Change calls (require wallet) ───────────────────────────────────────────

/**
 * Create a new bounty. Does NOT fund it — call fundBounty separately
 * (two separate transactions so the org can review before locking funds).
 */
export async function createBounty(params: {
  title: string
  description: string
  category: BountyCategory
  tierCritical: number   // USDC amount (not yocto)
  tierHigh: number
  tierMedium: number
  expiryDays: number
}): Promise<unknown> {
  const expiryMs = Date.now() + params.expiryDays * 24 * 60 * 60 * 1000

  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'create_bounty',
    args: {
      title: params.title,
      description: params.description,
      category: params.category,
      tiers: {
        critical: usdcToYocto(params.tierCritical),
        high: usdcToYocto(params.tierHigh),
        medium: usdcToYocto(params.tierMedium),
      },
      expiry_timestamp_ms: expiryMs,
    },
    gas: DEFAULT_GAS,
    deposit: '1',   // 1 yoctoNEAR for payable methods
  })
}

/**
 * Fund a bounty pool by calling ft_transfer_call on the USDC NEP-141 contract.
 * The USDC contract calls ft_on_transfer on SilentProof automatically.
 */
export async function fundBounty(bountyId: string, usdcAmount: number): Promise<unknown> {
  const msg = JSON.stringify({ action: 'fund_bounty', bounty_id: bountyId })

  return callContract({
    contractId: USDC_CONTRACT,
    methodName: 'ft_transfer_call',
    args: {
      receiver_id: CONTRACT_ADDRESS,
      amount: usdcToYocto(usdcAmount),
      msg,
    },
    gas: FUND_GAS,
    deposit: '1',   // 1 yoctoNEAR required for ft_transfer_call
  })
}

/**
 * Submit an anonymous report. No wallet required on the submitter side —
 * this is called via meta-transaction relay in practice. For now wires
 * directly (submitter's browser signs with a one-time key if they opt in).
 */
export async function submitReport(params: {
  bountyId: string
  ipfsCid: string
  payoutAddressHash: string
  wrappedKeyHex: string
  ephemeralPubkeyHex: string
}): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'submit_report',
    args: {
      bounty_id: params.bountyId,
      ipfs_cid: params.ipfsCid,
      payout_address_hash: params.payoutAddressHash,
      wrapped_key_hex: params.wrappedKeyHex,
      ephemeral_pubkey_hex: params.ephemeralPubkeyHex,
    },
    gas: DEFAULT_GAS,
    deposit: '1',
  })
}

/** Org confirms payout — releases USDC to submitter's address. */
export async function confirmPayout(
  reportId: string,
  payoutAddress: string
): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'confirm_payout',
    args: { report_id: reportId, payout_address: payoutAddress },
    gas: FUND_GAS,
    deposit: '1',
  })
}

/** Org rejects report — USDC stays in pool. */
export async function rejectReport(reportId: string): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'reject_report',
    args: { report_id: reportId },
    gas: DEFAULT_GAS,
    deposit: '1',
  })
}

/** Org withdraws unspent pool after bounty expires. */
export async function withdrawBounty(bountyId: string): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'withdraw_bounty',
    args: { bounty_id: bountyId },
    gas: DEFAULT_GAS,
    deposit: '1',
  })
}
