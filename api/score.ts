/**
 * Vercel function: scores any pending, unscored reports.
 *
 * The app calls this after a report is submitted and again from the
 * organization dashboard, so scoring happens without a server that has to
 * stay awake. It is idempotent: the contract rejects a second score for the
 * same report, and calling it with nothing to do is harmless.
 *
 * Secrets (Vercel environment variables, never VITE_ prefixed):
 *   TEE_KEYS_JSON         output of `bun run tee:env`
 *   TEE_NEAR_PRIVATE_KEY  access key that can ONLY call record_tee_score
 *   TEE_NEAR_ACCOUNT_ID   account that key belongs to (the contract account)
 * Optional: SILENTPROOF_CONTRACT_ID (default abbagigo.testnet), NEAR_AI_API_KEY.
 *
 * Testnet note: this is an ordinary function, not a confidential-compute
 * enclave. Whoever controls these secrets can read reports and sign scores.
 */

import { Account, KeyPairSigner, providers } from 'near-api-js'
import type { TeeKeys } from '../tee/crypto.js'
import {
  DEFAULT_RPC_URLS,
  listUnscored,
  processReport,
  type CoreConfig,
  type SignedScore,
} from '../tee/core.js'

interface Req {
  method?: string
}

interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

const MAX_PER_CALL = 5
const TIME_BUDGET_MS = 40_000
const MIN_GAP_MS = 3_000

// Module state survives between calls on a warm instance
let lastRun = 0

function shortError(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 160)
}

function makeSender(contractId: string) {
  const accountId = process.env.TEE_NEAR_ACCOUNT_ID ?? contractId
  const secret = process.env.TEE_NEAR_PRIVATE_KEY
  if (!secret) throw new Error('TEE_NEAR_PRIVATE_KEY is not set')

  const provider = new providers.FailoverRpcProvider(
    DEFAULT_RPC_URLS.map(url => new providers.JsonRpcProvider({ url })),
  )
  const signer = KeyPairSigner.fromSecretKey(secret as `ed25519:${string}`)
  const account = new Account(accountId, provider, signer)

  return async (s: SignedScore): Promise<void> => {
    await account.callFunction({
      contractId,
      methodName: 'record_tee_score',
      args: {
        report_id: s.reportId,
        tier: s.tier,
        score: s.score,
        summary_hash: s.summaryHash,
        signature_hex: s.signatureHex,
      },
      gas: BigInt('50000000000000'),
      waitUntil: 'INCLUDED',
    })
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Use POST' })
    return
  }

  const now = Date.now()
  if (now - lastRun < MIN_GAP_MS) {
    res.status(200).json({ throttled: true, scored: [], failed: [], remaining: 0 })
    return
  }
  lastRun = now

  const keysJson = process.env.TEE_KEYS_JSON
  if (!keysJson || !process.env.TEE_NEAR_PRIVATE_KEY) {
    res.status(503).json({ error: 'Scorer is not configured' })
    return
  }

  const contractId = process.env.SILENTPROOF_CONTRACT_ID ?? 'abbagigo.testnet'
  const cfg: CoreConfig = {
    contractId,
    rpcUrls: DEFAULT_RPC_URLS,
    nearAiApiKey: process.env.NEAR_AI_API_KEY,
    nearAiModel: process.env.NEAR_AI_MODEL,
  }

  try {
    const keys = JSON.parse(keysJson) as TeeKeys
    const send = makeSender(contractId)
    const pending = await listUnscored(cfg)
    const scored: number[] = []
    const failed: { id: number; error: string }[] = []
    const started = Date.now()

    for (const report of pending.slice(0, MAX_PER_CALL)) {
      if (Date.now() - started > TIME_BUDGET_MS) break
      try {
        await processReport(cfg, report, keys, send, () => {})
        scored.push(report.id)
      } catch (e) {
        failed.push({ id: report.id, error: shortError(e) })
      }
    }
    res.status(200).json({ scored, failed, remaining: Math.max(0, pending.length - scored.length - failed.length) })
  } catch (e) {
    res.status(500).json({ error: shortError(e) })
  }
}
