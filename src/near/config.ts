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
  (import.meta.env.VITE_NEAR_CONTRACT_ADDRESS as string | undefined) ?? 'silentproof.testnet'

/**
 * USDC NEP-141 token contract on NEAR testnet.
 * Circle's official USDC testnet contract.
 */
export const USDC_CONTRACT = 'usdc.fakes.testnet'

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
