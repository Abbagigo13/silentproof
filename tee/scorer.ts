/**
 * SilentProof — TEE scorer
 *
 * Decrypts submitted reports, scores them (severity + credibility), signs the
 * result and records it on the NEAR contract via record_tee_score.
 *
 * Commands (run from the project root):
 *   bun run tee:keygen                 create keys, print what to configure
 *   bun run tee:score -- --report-id 0 score one report
 *   bun run tee:watch                  poll the contract and score new reports
 *
 * Flags: --dry-run (do not send the transaction), --interval <seconds> (watch)
 *
 * Environment (all optional):
 *   SILENTPROOF_CONTRACT_ID  contract account (default abbagigo.testnet)
 *   TEE_ACCOUNT_ID           NEAR account that sends the transaction (default: the contract)
 *   NEAR_RPC_URL             tried first if set; otherwise FastNEAR endpoints, then rpc.testnet.near.org
 *   NEAR_NETWORK             default testnet
 *   NEAR_AI_API_KEY          enables LLM scoring; without it a keyword scorer is used
 *   TEE_KEYS_PATH            where keys are stored (default tee/.keys.json, gitignored)
 *
 * Sending uses the `near` CLI, so the sending account must be logged in
 * (credentials in ~/.near-credentials).
 *
 * Testnet demo note: this process is not inside a real confidential-compute
 * enclave. The key handling and message formats are the production design.
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decryptBlob,
  generateKeys,
  recoverSigner,
  signScore,
  type EncryptedBlob,
  type Tier,
  type TeeKeys,
} from './crypto'

// ─── Config ───────────────────────────────────────────────────────────────────

const CONTRACT_ID = process.env.SILENTPROOF_CONTRACT_ID ?? 'abbagigo.testnet'
const TEE_ACCOUNT_ID = process.env.TEE_ACCOUNT_ID ?? CONTRACT_ID
// rpc.testnet.near.org is deprecated and rate-limits heavily, so FastNEAR goes first.
const RPC_URLS: string[] = [
  ...(process.env.NEAR_RPC_URL ? [process.env.NEAR_RPC_URL] : []),
  'https://rpc.testnet.fastnear.com',
  'https://test.rpc.fastnear.com',
  'https://rpc.testnet.near.org',
]
const CLI_NODE_URL = RPC_URLS[0]
const NETWORK = process.env.NEAR_NETWORK ?? 'testnet'
const NEAR_AI_API_KEY = process.env.NEAR_AI_API_KEY ?? ''
const NEAR_AI_BASE_URL = 'https://api.near.ai/v1'
const LLM_MODEL = process.env.NEAR_AI_MODEL ?? 'near/llama-3.1-70b-instruct'
const KEYS_PATH = process.env.TEE_KEYS_PATH ?? join(dirname(fileURLToPath(import.meta.url)), '.keys.json')

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
]

// ─── Types (mirror the contract's JSON) ───────────────────────────────────────

interface ChainReport {
  id: number
  bounty_id: number
  ipfs_cid: string
  status: 'Pending' | 'Confirmed' | 'Rejected'
  tee_tier: Tier | null
}

interface ChainBounty {
  id: number
}

interface ScoreResult {
  severity: Tier
  credibility: number
  summary: string
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

function loadKeys(): TeeKeys {
  if (!existsSync(KEYS_PATH)) {
    throw new Error(`No keys found at ${KEYS_PATH}. Run: bun run tee:keygen`)
  }
  return JSON.parse(readFileSync(KEYS_PATH, 'utf8')) as TeeKeys
}

async function keygen(force: boolean): Promise<void> {
  if (existsSync(KEYS_PATH) && !force) {
    const keys = loadKeys()
    console.log(`Keys already exist at ${KEYS_PATH} (use --force to replace them).\n`)
    printKeyInstructions(keys)
    return
  }
  const keys = await generateKeys()
  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2), { mode: 0o600 })
  try { chmodSync(KEYS_PATH, 0o600) } catch { /* best effort */ }
  console.log(`Created ${KEYS_PATH} (private keys, never commit this file).\n`)
  printKeyInstructions(keys)
}

function printKeyInstructions(keys: TeeKeys): void {
  console.log('1) Encryption key for the app. Put this in .env (and restart the dev server):')
  console.log(`   VITE_TEE_PUBLIC_KEY=${keys.encPublicHex}\n`)
  console.log('2) Signing key for the contract. Register it once, as the contract owner:')
  console.log(
    `   near call ${CONTRACT_ID} register_tee_key '${JSON.stringify({ public_key_hex: keys.signPublicHex })}' --accountId ${CONTRACT_ID} --networkId ${NETWORK}\n`,
  )
}

// ─── NEAR RPC ─────────────────────────────────────────────────────────────────

async function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 'silentproof',
    method: 'query',
    params: {
      request_type: 'call_function',
      finality: 'final',
      account_id: CONTRACT_ID,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
    },
  })
  let lastError = 'no endpoint tried'
  for (const url of RPC_URLS) {
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
      return JSON.parse(Buffer.from(data.result.result).toString('utf8')) as T
    } catch (e) {
      lastError = `${url} -> ${e instanceof Error ? e.message : String(e)}`
    }
  }
  throw new Error(`View ${method} failed on every endpoint. Last: ${lastError}`)
}

function runCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('near', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d: Buffer) => { out += d.toString() })
    child.stderr.on('data', (d: Buffer) => { out += d.toString() })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(out)
      else reject(new Error(`near CLI exited with ${code}: ${out.slice(-400)}`))
    })
  })
}

async function recordScore(
  reportId: number,
  tier: Tier,
  score: number,
  summaryHash: string,
  signatureHex: string,
): Promise<void> {
  const args = { report_id: reportId, tier, score, summary_hash: summaryHash, signature_hex: signatureHex }
  await runCli([
    'call', CONTRACT_ID, 'record_tee_score', JSON.stringify(args),
    '--accountId', TEE_ACCOUNT_ID,
    '--networkId', NETWORK,
    '--nodeUrl', CLI_NODE_URL,
    '--gas', '100000000000000',
  ])
}

// ─── IPFS ─────────────────────────────────────────────────────────────────────

async function fetchBlob(cid: string): Promise<EncryptedBlob> {
  let lastError = 'no gateway tried'
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gateway}${cid}`, { signal: AbortSignal.timeout(20_000) })
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

function demoScore(text: string): ScoreResult {
  const t = text.toLowerCase()
  let severity: Tier = 'Medium'
  let credibility = 55
  if (['fraud', 'embezzle', 'brib', 'safety', 'injur', 'illegal', 'launder'].some(k => t.includes(k))) {
    severity = 'Critical'
    credibility = 75
  } else if (['violation', 'discriminat', 'harass', 'conflict of interest'].some(k => t.includes(k))) {
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

async function scoreReport(text: string): Promise<ScoreResult> {
  if (!NEAR_AI_API_KEY) {
    console.log('[scorer] NEAR_AI_API_KEY not set, using the keyword scorer')
    return demoScore(text)
  }
  try {
    const res = await fetch(`${NEAR_AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${NEAR_AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [{ role: 'user', content: SCORING_PROMPT + text }],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
    const data = (await res.json()) as { choices: { message: { content: string } }[] }
    const content = data.choices[0].message.content.trim().replace(/^```(?:json)?|```$/g, '').trim()
    return normalizeScore(JSON.parse(content))
  } catch (e) {
    console.warn(`[scorer] LLM scoring failed (${e instanceof Error ? e.message : String(e)}), using the keyword scorer`)
    return demoScore(text)
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function processReport(report: ChainReport, keys: TeeKeys, dryRun: boolean): Promise<void> {
  console.log(`\n[scorer] Report #${report.id} (bounty #${report.bounty_id}) cid=${report.ipfs_cid}`)

  const blob = await fetchBlob(report.ipfs_cid)
  const decrypted = await decryptBlob(blob, keys.encPrivateJwk)
  console.log(`[scorer] Decrypted ${decrypted.text.length} characters`)

  const result = await scoreReport(decrypted.text)
  const summaryHash = await sha256Hex(result.summary)
  const signature = signScore(report.id, result.severity, result.credibility, summaryHash, keys.signPrivateHex)

  // Self-check: the signature must recover to the key registered on the contract
  const signer = recoverSigner(report.id, result.severity, result.credibility, summaryHash, signature)
  if (signer !== keys.signPublicHex) throw new Error('Self-check failed: signature does not recover to the signing key')

  console.log(`[scorer] ${result.severity}, credibility ${result.credibility}/100`)
  console.log(`[scorer] summary (stays here, only its hash goes onchain): ${result.summary}`)

  if (dryRun) {
    console.log('[scorer] --dry-run: not sending the transaction')
    return
  }
  await recordScore(report.id, result.severity, result.credibility, summaryHash, signature)
  console.log(`[scorer] Recorded onchain for report #${report.id}`)
}

async function listUnscored(): Promise<ChainReport[]> {
  const bounties = await view<ChainBounty[]>('get_active_bounties', { limit: 50 })
  const out: ChainReport[] = []
  for (const b of bounties) {
    const reports = await view<ChainReport[]>('get_reports_by_bounty', { bounty_id: b.id, limit: 50 })
    out.push(...reports.filter(r => r.status === 'Pending' && r.tee_tier === null))
  }
  return out
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const dryRun = flag('dry-run')

  if (command === 'keygen') return keygen(flag('force'))

  const keys = loadKeys()
  console.log(`[scorer] contract=${CONTRACT_ID} sender=${TEE_ACCOUNT_ID} network=${NETWORK}${dryRun ? ' (dry run)' : ''}`)

  if (command === 'score') {
    const id = Number(option('report-id'))
    if (!Number.isInteger(id) || id < 0) throw new Error('Usage: score --report-id <n>')
    const report = await view<ChainReport | null>('get_report', { report_id: id })
    if (!report) throw new Error(`Report #${id} not found`)
    if (report.tee_tier !== null) throw new Error(`Report #${id} is already scored`)
    return processReport(report, keys, dryRun)
  }

  if (command === 'watch') {
    const intervalMs = Math.max(5, Number(option('interval') ?? 15)) * 1000
    const failed = new Map<number, number>()
    console.log(`[scorer] Watching for new reports every ${intervalMs / 1000}s. Ctrl+C to stop.`)
    for (;;) {
      try {
        for (const report of await listUnscored()) {
          if ((failed.get(report.id) ?? 0) >= 3) continue
          try {
            await processReport(report, keys, dryRun)
            if (dryRun) failed.set(report.id, 3) // do not loop on the same report in dry run
          } catch (e) {
            failed.set(report.id, (failed.get(report.id) ?? 0) + 1)
            console.error(`[scorer] Report #${report.id} failed: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
      } catch (e) {
        console.error(`[scorer] Poll failed: ${e instanceof Error ? e.message : String(e)}`)
      }
      await new Promise(r => setTimeout(r, intervalMs))
    }
  }

  console.log('Usage: bun run tee:keygen | tee:score -- --report-id <n> | tee:watch  [--dry-run]')
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
