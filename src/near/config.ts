/**
 * SilentProof — NEAR network config
 * All contract addresses and RPC endpoints live here.
 * Update CONTRACT_ADDRESS after deploying to testnet.
 */

export const NEAR_CONFIG = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://testnet.mynearwallet.com',
  helperUrl: 'https://helper.testnet.near.org',
  explorerUrl: 'https://testnet.nearblocks.io',
} as const

/**
 * Deployed contract account ID on NEAR testnet.
 * Replace with actual account after `near deploy`.
 * Format: "silentproof.YOUR_ACCOUNT.testnet"
 */
export const CONTRACT_ADDRESS: string =
  (import.meta.env.VITE_NEAR_CONTRACT_ADDRESS as string | undefined) ?? 'abbagigo.testnet'

/**
 * Circle's native USDC (NEP-141) on NEAR testnet, from
 * https://developers.circle.com/stablecoins/usdc-contract-addresses
 * Anyone can get some from https://faucet.circle.com (choose NEAR Testnet).
 * The deployed contract stores the same address; keep them in sync.
 */
export const USDC_CONTRACT: string =
  (import.meta.env.VITE_USDC_CONTRACT as string | undefined)?.trim() ||
  '3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af'

export const USDC_FAUCET_URL = 'https://faucet.circle.com'

/** USDC has 6 decimals on NEAR (same as EVM) */
export const USDC_DECIMALS = 6

/** Storage deposit required when calling ft_transfer_call (in yoctoNEAR) */
export const STORAGE_DEPOSIT_AMOUNT = '1250000000000000000000' // 0.00125 NEAR

/** Gas for complex calls (in gas units) */
export const DEFAULT_GAS = '100000000000000' // 100 TGas
export const FUND_GAS = '200000000000000'    // 200 TGas — for ft_transfer_call cross-contract

/** Minimum storage deposit for a new USDC account (in USDC yocto) */
export const MIN_STORAGE_DEPOSIT = '100000' // 0.1 USDC

export function usdcToYocto(usdc: number): string {
  return Math.floor(usdc * 10 ** USDC_DECIMALS).toString()
}

export function yoctoToUsdc(yocto: string): number {
  return Number(yocto) / 10 ** USDC_DECIMALS
}

export function buildExplorerTxUrl(txHash: string): string {
  return `${NEAR_CONFIG.explorerUrl}/txns/${txHash}`
}

export function buildExplorerAccountUrl(accountId: string): string {
  return `${NEAR_CONFIG.explorerUrl}/accounts/${accountId}`
}
