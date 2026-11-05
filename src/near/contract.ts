/**
 * SilentProof — Typed NEAR contract bindings
 *
 * Mirrors the deployed Rust contract (contracts/near/silentproof/src/lib.rs).
 * View calls use raw JSON-RPC (no wallet needed).
 * Change calls use callContract() which requires a signed-in wallet.
 *
 * Note: none of the contract's change methods are #[payable], so they must be
 * called with a 0 deposit. Only the USDC ft_transfer_call needs 1 yoctoNEAR.
 */

import { callContract, viewContract } from './wallet'
import {
  CONTRACT_ADDRESS,
  USDC_CONTRACT,
  FUND_GAS,
  DEFAULT_GAS,
  STORAGE_DEPOSIT_AMOUNT,
  usdcToYocto,
} from './config'

// ─── Shared types (mirror the Rust contract's JSON) ───────────────────────────

export type BountyCategory = 'Fraud' | 'Security' | 'Policy' | 'Legal'
export type SeverityTier = 'Critical' | 'High' | 'Medium'
export type ReportStatus = 'Pending' | 'Confirmed' | 'Rejected'

export interface Bounty {
  id: number
  org_account: string
  title: string
  description: string
  category: BountyCategory
  /** USDC base units (6 decimals) as a decimal string */
  tier_critical: string
  tier_high: string
  tier_medium: string
  pool_balance: string
  /** Block timestamp in nanoseconds */
  expiry_ns: number
  active: boolean
}

export interface Report {
  id: number
  bounty_id: number
  ipfs_cid: string
  payout_address_hash: string
  author_account: string | null
  tee_tier: SeverityTier | null
  tee_score: number | null
  /** SHA-256 of the AI summary. The plaintext summary stays inside the TEE. */
  tee_summary_hash: string | null
  status: ReportStatus
  submitted_at_ns: number
}

export interface ContractInfo {
  owner: string
  tee_key_registered: boolean
  total_bounties: number
  total_reports: number
  paused: boolean
  usdc_contract: string
}

// ─── View calls (read-only, no wallet needed) ─────────────────────────────────

export async function getActiveBounties(): Promise<Bounty[]> {
  return viewContract<Bounty[]>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_active_bounties',
    args: { from_index: 0, limit: 50 },
  })
}

export async function getBountiesByOrg(orgAccount: string): Promise<Bounty[]> {
  return viewContract<Bounty[]>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_bounties_by_org',
    args: { org_account: orgAccount },
  })
}

export async function getReportsForOrg(orgAccount: string): Promise<Report[]> {
  return viewContract<Report[]>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_reports_for_org',
    args: { org_account: orgAccount, status_filter: null },
  })
}

export async function getContractInfo(): Promise<ContractInfo> {
  return viewContract<ContractInfo>({
    contractId: CONTRACT_ADDRESS,
    methodName: 'get_contract_info',
    args: {},
  })
}

// ─── Change calls (require wallet) ───────────────────────────────────────────

/**
 * Create a new bounty. It starts with an empty pool: call fundBounty next
 * (two transactions so the org reviews before locking funds).
 */
export async function createBounty(params: {
  title: string
  description: string
  category: BountyCategory
  tierCritical: number   // USDC amount (not base units)
  tierHigh: number
  tierMedium: number
  expiryDays: number
}): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'create_bounty',
    args: {
      title: params.title,
      description: params.description,
      category: params.category,
      tier_critical: usdcToYocto(params.tierCritical),
      tier_high: usdcToYocto(params.tierHigh),
      tier_medium: usdcToYocto(params.tierMedium),
      expiry_days: params.expiryDays,
    },
    gas: DEFAULT_GAS,
    deposit: '0',
  })
}

/**
 * Register the SilentProof contract on the USDC token so it can receive
 * transfers (NEP-141 storage_deposit). Safe to call more than once.
 */
export async function registerContractOnUsdc(): Promise<unknown> {
  return callContract({
    contractId: USDC_CONTRACT,
    methodName: 'storage_deposit',
    args: { account_id: CONTRACT_ADDRESS, registration_only: true },
    gas: DEFAULT_GAS,
    deposit: STORAGE_DEPOSIT_AMOUNT,
  })
}

/**
 * Fund a bounty pool via ft_transfer_call on the USDC token. The token calls
 * ft_on_transfer on SilentProof, which expects msg to be the bounty id.
 */
export async function fundBounty(bountyId: number, usdcAmount: number): Promise<unknown> {
  return callContract({
    contractId: USDC_CONTRACT,
    methodName: 'ft_transfer_call',
    args: {
      receiver_id: CONTRACT_ADDRESS,
      amount: usdcToYocto(usdcAmount),
      msg: String(bountyId),
    },
    gas: FUND_GAS,
    deposit: '1',   // 1 yoctoNEAR required by NEP-141
  })
}

/**
 * Submit an anonymous report. Only the IPFS CID of the encrypted blob and the
 * SHA-256 of the payout address go onchain.
 */
export async function submitReport(params: {
  bountyId: number
  ipfsCid: string
  payoutAddressHash: string
  authorAccount?: string | null
}): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'submit_report',
    args: {
      bounty_id: params.bountyId,
      ipfs_cid: params.ipfsCid,
      payout_address_hash: params.payoutAddressHash,
      author_account: params.authorAccount ?? null,
    },
    gas: DEFAULT_GAS,
    deposit: '0',
  })
}

/**
 * Org confirms payout. The contract checks sha256(payoutAddress) against the
 * hash stored at submission, then sends USDC to that address.
 */
export async function confirmPayout(
  reportId: number,
  payoutAddress: string
): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'confirm_payout',
    args: { report_id: reportId, payout_address: payoutAddress },
    gas: FUND_GAS,
    deposit: '0',
  })
}

/** Org rejects report: USDC stays in the pool. */
export async function rejectReport(reportId: number): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'reject_report',
    args: { report_id: reportId },
    gas: DEFAULT_GAS,
    deposit: '0',
  })
}

/** Org withdraws unspent pool after the bounty expires. */
export async function withdrawBounty(bountyId: number): Promise<unknown> {
  return callContract({
    contractId: CONTRACT_ADDRESS,
    methodName: 'withdraw_bounty',
    args: { bounty_id: bountyId },
    gas: DEFAULT_GAS,
    deposit: '0',
  })
}
