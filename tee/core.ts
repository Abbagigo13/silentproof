/**
 * SilentProof — scorer core
 *
 * Environment-agnostic pipeline shared by the CLI (tee/scorer.ts) and the
 * serverless function (api/score.ts). No filesystem, no process.argv.
 *
 * Pipeline per report: fetch encrypted blob, decrypt, score, sign, self-check,
 * then hand the signed result to a `send` function supplied by the caller.
 */

import {
  decryptBlob,
  recoverSigner,
  signScore,
  type EncryptedBlob,
  type Tier,
  type TeeKeys,
} from './crypto.js'

export interface CoreConfig {
  contractId: string
  /** Tried in order; the first that answers wins */
  rpcUrls: string[]
  nearAiApiKey?: string
  nearAiModel?: string
}

export interface ChainReport {
  id: number
  bounty_id: number
  ipfs_cid: string
  status: 'Pending' | 'Confirmed' | 'Rejected'
  tee_tier: Tier | null
}

interface ChainBounty {
  id: number
}

export interface ScoreResult {
  severity: Tier
  credibility: number
  summary: string
}

export interface SignedScore {
  reportId: number
  tier: Tier
  score: number
  summaryHash: string
  signatureHex: string
}

export type SendScore = (signed: SignedScore) => Promise<void>

export const DEFAULT_RPC_URLS = [
  'https://rpc.testnet.fastnear.com',
  'https://test.rpc.fastnear.com',
  'https://rpc.testnet.near.org',
]

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
]

// ─── NEAR view calls ──────────────────────────────────────────────────────────

export async function view<T>(cfg: CoreConfig, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 'silentproof',
    method: 'query',
    params: {
      request_type: 'call_function',
      finality: 'final',
      account_id: cfg.contractId,
      method_name: method,
      args_base64: btoa(JSON.stringify(args)),
    },
  })
  let lastError = 'no endpoint tried'
  for (const url of cfg.rpcUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      const data = (await res.json()) as { result?: { result: number[] }; error?: unknown }
      if (data.error || !data.result) {
        lastError = `${url} -> ${JSON.stringify(data.error ?? data).slice(0, 160)}`
        continue
      }
      return JSON.parse(new TextDecoder().decode(new Uint8Array(data.result.result))) as T
    } catch (e) {
      lastError = `${url} -> ${e instanceof Error ? e.message : String(e)}`
    }
  }
  throw new Error(`View ${method} failed on every endpoint. Last: ${lastError}`)
}

export async function getReport(cfg: CoreConfig, id: number): Promise<ChainReport | null> {
  return view<ChainReport | null>(cfg, 'get_report', { report_id: id })
}

/** Pending reports that have no score yet, across all active bounties. */
export async function listUnscored(cfg: CoreConfig): Promise<ChainReport[]> {
  const bounties = await view<ChainBounty[]>(cfg, 'get_active_bounties', { limit: 50 })
  const out: ChainReport[] = []
  for (const b of bounties) {
    const reports = await view<ChainReport[]>(cfg, 'get_reports_by_bounty', { bounty_id: b.id, limit: 50 })
    out.push(...reports.filter(r => r.status === 'Pending' && r.tee_tier === null))
  }
  return out
}

// ─── IPFS ─────────────────────────────────────────────────────────────────────

async function fetchBlob(cid: string): Promise<EncryptedBlob> {
  let lastError = 'no gateway tried'
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gateway}${cid}`, { signal: AbortSignal.timeout(15_000) })
      if (res.ok) return (await res.json()) as EncryptedBlob
      lastError = `${gateway} -> ${res.status}`
    } catch (e) {
      lastError = `${gateway} -> ${e instanceof Error ? e.message : String(e)}`
    }
  }
  throw new Error(`Could not fetch ${cid} from any gateway (${lastError})`)
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const SCORING_PROMPT = `You are a compliance analyst reviewing an anonymous whistleblower report.
Score it on:
1. SEVERITY: Critical (ongoing fraud, safety risk, major legal violation), High (significant policy violation), Medium (minor breach or process failure).
2. CREDIBILITY, integer 0-100: 90-100 specific dates, names, amounts, documents; 70-89 specific but missing detail; 50-69 plausible but vague; 30-49 very vague; 0-29 implausible or fabricated.
3. SUMMARY: one anonymized sentence. No names, places or identifying details.

Respond with ONLY JSON, no markdown:
{"severity":"Critical"|"High"|"Medium","credibility":<0-100>,"summary":"<one sentence>"}

Report:
`

export function demoScore(text: string): ScoreResult {
  const t = text.toLowerCase()
  let severity: Tier = 'Medium'
  let credibility = 55
  const critical = [
    'fraud', 'embezzle', 'brib', 'kickback', 'launder', 'corrupt', 'forged', 'falsif', 'theft', 'stole',
    'safety', 'unsafe', 'injur', 'death', 'died', 'assault', 'illegal', 'toxic', 'hazard',
  ]
  const high = [
    'violation', 'discriminat', 'harass', 'conflict of interest', 'abuse', 'abusive', 'retaliat', 'exploit',
    'wage', 'overtime', 'misappropriat', 'negligen', 'cover up', 'covered up', 'breach', 'threat',
  ]
  if (critical.some(k => t.includes(k))) {
    severity = 'Critical'
    credibility = 75
  } else if (high.some(k => t.includes(k))) {
    severity = 'High'
    credibility = 65
  }
  if (/\d/.test(text)) credibility += 10
  if (text.length > 500) credibility += 5
  return {
    severity,
    credibility: Math.min(credibility, 100),
    summary: 'Report describes alleged misconduct involving organizational processes and financial controls.',
  }
}

function normalizeScore(raw: unknown): ScoreResult {
  const r = raw as Partial<Record<string, unknown>>
  const sev = String(r.severity ?? '').toLowerCase()
  const severity: Tier = sev === 'critical' ? 'Critical' : sev === 'high' ? 'High' : 'Medium'
  const credibility = Math.max(0, Math.min(100, Math.round(Number(r.credibility))))
  const summary = String(r.summary ?? '').trim()
  if (!Number.isFinite(credibility) || summary.length === 0) throw new Error('LLM returned an unusable score')
  return { severity, credibility, summary }
}

export async function scoreReport(cfg: CoreConfig, text: string, log: (m: string) => void): Promise<ScoreResult> {
  if (!cfg.nearAiApiKey) return demoScore(text)
  try {
    const res = await fetch('https://api.near.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.nearAiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.nearAiModel ?? 'near/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: SCORING_PROMPT + text }],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(40_000),
    })
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
    const data = (await res.json()) as { choices: { message: { content: string } }[] }
    const content = data.choices[0].message.content.trim().replace(/^```(?:json)?|```$/g, '').trim()
    return normalizeScore(JSON.parse(content))
  } catch (e) {
    log(`LLM scoring failed (${e instanceof Error ? e.message : String(e)}), using the keyword scorer`)
    return demoScore(text)
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function processReport(
  cfg: CoreConfig,
  report: ChainReport,
  keys: TeeKeys,
  send: SendScore | null,
  log: (m: string) => void,
): Promise<void> {
  log(`Report #${report.id} (bounty #${report.bounty_id}) cid=${report.ipfs_cid}`)

  const blob = await fetchBlob(report.ipfs_cid)
  const decrypted = await decryptBlob(blob, keys.encPrivateJwk)
  log(`Decrypted ${decrypted.text.length} characters`)

  const result = await scoreReport(cfg, decrypted.text, log)
  const summaryHash = await sha256Hex(result.summary)
  const signatureHex = signScore(report.id, result.severity, result.credibility, summaryHash, keys.signPrivateHex)

  // Self-check: the signature must recover to the key registered on the contract
  const signer = recoverSigner(report.id, result.severity, result.credibility, summaryHash, signatureHex)
  if (signer !== keys.signPublicHex) throw new Error('Self-check failed: signature does not recover to the signing key')

  log(`${result.severity}, credibility ${result.credibility}/100 (summary stays here; only its hash goes onchain)`)

  if (!send) {
    log('Dry run: not sending the transaction')
    return
  }
  await send({ reportId: report.id, tier: result.severity, score: result.credibility, summaryHash, signatureHex })
  log(`Recorded onchain for report #${report.id}`)
}
