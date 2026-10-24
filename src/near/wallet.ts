/**
 * SilentProof — NEAR Wallet Selector
 *
 * Used only on the org side. Submitters never connect a wallet
 * (their path is anonymous form → encrypt → IPFS → relay).
 *
 * Exports:
 *   initWallet()        — call once on app mount (org mode)
 *   getWallet()         — get the singleton after init
 *   getAccountId()      — current signed-in account, or null
 *   signIn()            — open wallet selector modal
 *   signOut()           — disconnect wallet
 *   walletState         — reactive store (use with useSyncExternalStore)
 */

import { setupWalletSelector, type WalletSelector, type AccountState } from '@near-wallet-selector/core'
import type { FunctionCallAction } from '@near-wallet-selector/core/src/lib/wallet/transactions.types'
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet'
import { NEAR_CONFIG, CONTRACT_ADDRESS } from './config'

// ─── Singleton ────────────────────────────────────────────────────────────────

let _selector: WalletSelector | null = null
let _initPromise: Promise<WalletSelector> | null = null

// Simple external store for React integration
type Listener = () => void
const listeners = new Set<Listener>()
let _accountId: string | null = null

function notify() {
  listeners.forEach(l => l())
}

export const walletStore = {
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): string | null {
    return _accountId
  },
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initWallet(): Promise<WalletSelector> {
  if (_selector) return _selector
  if (_initPromise) return _initPromise

  _initPromise = setupWalletSelector({
    network: NEAR_CONFIG.networkId,
    modules: [
      setupMyNearWallet({
        walletUrl: NEAR_CONFIG.walletUrl,
      }),
    ],
  }).then(selector => {
    _selector = selector

    // Sync account state reactively
    const syncAccount = (accounts: AccountState[]) => {
      _accountId = accounts.length > 0 ? accounts[0].accountId : null
      notify()
    }

    selector.store.observable.subscribe(state => {
      syncAccount(state.accounts)
    })

    // Sync initial state
    syncAccount(selector.store.getState().accounts)

    return selector
  })

  return _initPromise
}

export function getSelector(): WalletSelector | null {
  return _selector
}

export function getAccountId(): string | null {
  return _accountId
}

// ─── Sign in / out ────────────────────────────────────────────────────────────

export async function signIn(): Promise<void> {
  const selector = await initWallet()
  const wallet = await selector.wallet('my-near-wallet')

  // Wallet Selector v10 signIn types are an overly-strict intersection;
  // MyNearWallet only needs contractId + methodNames at runtime.
  type SimpleSignIn = { contractId: string; methodNames?: string[] }
  await (wallet.signIn as unknown as (p: SimpleSignIn) => Promise<void>)({
    contractId: CONTRACT_ADDRESS,
    methodNames: [
      'create_bounty',
      'confirm_payout',
      'reject_report',
      'withdraw_bounty',
      'register_tee_key',
    ],
  })
}

export async function signOut(): Promise<void> {
  if (!_selector) return
  const wallet = await _selector.wallet('my-near-wallet')
  await wallet.signOut()
  _accountId = null
  notify()
}

// ─── Call helpers (used by contract.ts) ──────────────────────────────────────

export interface CallOptions {
  contractId: string
  methodName: string
  args: Record<string, unknown>
  gas?: string
  deposit?: string
}

export async function callContract(opts: CallOptions): Promise<unknown> {
  if (!_selector) throw new Error('Wallet not initialized. Call initWallet() first.')
  const wallet = await _selector.wallet('my-near-wallet')

  const action: FunctionCallAction = {
    type: 'FunctionCall',
    params: {
      methodName: opts.methodName,
      args: opts.args,
      gas: opts.gas ?? '100000000000000',
      deposit: opts.deposit ?? '0',
    },
  }

  type SimpleTx = { receiverId: string; actions: FunctionCallAction[] }
  return (wallet.signAndSendTransaction as unknown as (tx: SimpleTx) => Promise<unknown>)({
    receiverId: opts.contractId,
    actions: [action],
  })
}

export interface ViewOptions {
  contractId: string
  methodName: string
  args?: Record<string, unknown>
}

export async function viewContract<T>(opts: ViewOptions): Promise<T> {
  const { contractId, methodName, args = {} } = opts
  const url = NEAR_CONFIG.nodeUrl
  const body = {
    jsonrpc: '2.0',
    id: 'dontcare',
    method: 'query',
    params: {
      request_type: 'call_function',
      finality: 'final',
      account_id: contractId,
      method_name: methodName,
      args_base64: btoa(JSON.stringify(args)),
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json() as { result?: { result: number[] }; error?: unknown }
  if (data.error) throw new Error(JSON.stringify(data.error))
  if (!data.result) throw new Error('No result from NEAR RPC view call')

  const bytes = new Uint8Array(data.result.result)
  const text = new TextDecoder().decode(bytes)
  return JSON.parse(text) as T
}
